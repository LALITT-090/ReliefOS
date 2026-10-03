"use client";

import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

type ReliefSnapshot = { twin: any; allocations: any[] };
type ScenarioLoad = {
  scenario_id: string;
  scenario_name: string;
  state_version: number;
};

type ReliefDataValue = {
  twin: any;
  allocations: any[];
  loading: boolean;
  error: any;
  refreshSnapshot: (force?: boolean) => Promise<ReliefSnapshot>;
  loadScenario: (scenarioId: string) => Promise<ScenarioLoad>;
};

const ReliefDataContext = createContext<ReliefDataValue | null>(null);

export function useReliefData() {
  const value = useContext(ReliefDataContext);
  if (!value) throw new Error("useReliefData must be used within ReliefDataProvider");
  return value;
}

export function ReliefDataProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  const [twin, setTwin] = useState<any>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const inFlight = useRef<Promise<ReliefSnapshot> | null>(null);
  const lastSuccessfulFetch = useRef(0);
  const twinRef = useRef<any>(null);
  const allocationsRef = useRef<any[]>([]);
  const snapshotRequestVersion = useRef(0);
  const scenarioLoadInProgress = useRef(false);

  const refreshSnapshot = useCallback((force = false, expectedScenarioId?: string) => {
    const fetchSnapshot = () => {
      const requestVersion = ++snapshotRequestVersion.current;
      const request = Promise.allSettled([
        axios.get(`${API_BASE_URL}/v1/twin`),
        axios.get(`${API_BASE_URL}/v1/allocations`),
      ])
        .then(([twinResult, allocationsResult]) => {
          if (requestVersion !== snapshotRequestVersion.current) {
            return { twin: twinRef.current, allocations: allocationsRef.current };
          }
          if (twinResult.status === "rejected") {
            throw twinResult.reason;
          }

          const nextTwin = twinResult.value.data;
          if (expectedScenarioId && nextTwin.scenario?.id !== expectedScenarioId) {
            throw new Error("The backend has not confirmed the requested active scenario yet.");
          }

          const scenarioChanged = twinRef.current?.scenario?.id !== nextTwin.scenario?.id;
          if (scenarioChanged) {
            allocationsRef.current = [];
            setAllocations([]);
          }
          twinRef.current = nextTwin;
          setTwin((current: any) =>
            current?.state_version === nextTwin.state_version &&
            current?.scenario?.id === nextTwin.scenario?.id ? current : nextTwin
          );
          lastSuccessfulFetch.current = Date.now();

          if (allocationsResult.status === "rejected") {
            throw allocationsResult.reason;
          }

          if (
            allocationsResult.value.data.scenario_id &&
            allocationsResult.value.data.scenario_id !== nextTwin.scenario?.id
          ) {
            throw new Error("The allocation snapshot belongs to a different active scenario.");
          }

          const nextAllocations = allocationsResult.value.data.allocations || [];
          allocationsRef.current = nextAllocations;
          setAllocations((current) =>
            JSON.stringify(current) === JSON.stringify(nextAllocations) ? current : nextAllocations
          );
          setError(null);
          setLoading(false);
          return { twin: nextTwin, allocations: nextAllocations };
        })
        .catch((requestError) => {
          setError(requestError);
          setLoading(false);
          throw requestError;
        })
        .finally(() => {
          if (inFlight.current === request) inFlight.current = null;
        });

      inFlight.current = request;
      return request;
    };

    if (scenarioLoadInProgress.current) {
      return Promise.resolve({ twin: twinRef.current, allocations: allocationsRef.current });
    }
    if (inFlight.current) {
      if (!force) return inFlight.current;
      return inFlight.current.then(fetchSnapshot, fetchSnapshot);
    }
    if (!force && Date.now() - lastSuccessfulFetch.current < 1500) {
      return Promise.resolve({ twin: twinRef.current, allocations: allocationsRef.current });
    }

    return fetchSnapshot();
  }, []);

  const loadScenario = useCallback(async (scenarioId: string): Promise<ScenarioLoad> => {
    if (scenarioLoadInProgress.current) {
      throw new Error("A scenario load is already in progress.");
    }
    scenarioLoadInProgress.current = true;
    ++snapshotRequestVersion.current;
    inFlight.current = null;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/v1/scenarios/${scenarioId}/load`);
      const result = response.data as ScenarioLoad & { snapshot: any; allocations: any[] };
      if (result.scenario_id !== scenarioId || result.snapshot?.scenario?.id !== scenarioId) {
        throw new Error("The backend response did not confirm the requested scenario.");
      }

      twinRef.current = result.snapshot;
      allocationsRef.current = result.allocations || [];
      setTwin(result.snapshot);
      setAllocations(allocationsRef.current);
      lastSuccessfulFetch.current = Date.now();
      setLoading(false);
      scenarioLoadInProgress.current = false;
      return {
        scenario_id: result.scenario_id,
        scenario_name: result.scenario_name,
        state_version: result.state_version,
      };
    } catch (requestError) {
      scenarioLoadInProgress.current = false;
      setLoading(false);
      setError(requestError);
      throw requestError;
    }
  }, []);

  useEffect(() => {
    const intervalMs = pathname === "/"
      ? 2500
      : pathname === "/map" || pathname === "/allocations"
      ? 3000
      : pathname === "/predictions"
      ? 4000
      : 10000;

    void refreshSnapshot().catch(() => undefined);
    const interval = setInterval(() => {
      if (!scenarioLoadInProgress.current) {
        void refreshSnapshot(true).catch(() => undefined);
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [pathname, refreshSnapshot]);

  return (
    <ReliefDataContext.Provider value={{ twin, allocations, loading, error, refreshSnapshot, loadScenario }}>
      {children}
    </ReliefDataContext.Provider>
  );
}
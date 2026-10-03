"use client";

import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

type ReliefSnapshot = { twin: any; allocations: any[] };

type ReliefDataValue = {
  twin: any;
  allocations: any[];
  loading: boolean;
  error: any;
  refreshSnapshot: (force?: boolean) => Promise<ReliefSnapshot>;
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

  const refreshSnapshot = useCallback((force = false) => {
    const fetchSnapshot = () => {
      const request = Promise.allSettled([
        axios.get(`${API_BASE_URL}/v1/twin`),
        axios.get(`${API_BASE_URL}/v1/allocations`),
      ])
        .then(([twinResult, allocationsResult]) => {
          if (twinResult.status === "rejected") {
            throw twinResult.reason;
          }

          const nextTwin = twinResult.value.data;
          twinRef.current = nextTwin;
          setTwin((current: any) =>
            current?.state_version === nextTwin.state_version &&
            current?.scenario?.id === nextTwin.scenario?.id ? current : nextTwin
          );
          lastSuccessfulFetch.current = Date.now();

          if (allocationsResult.status === "rejected") {
            throw allocationsResult.reason;
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
          inFlight.current = null;
        });

      inFlight.current = request;
      return request;
    };

    if (inFlight.current) {
      if (!force) return inFlight.current;
      return inFlight.current.then(fetchSnapshot, fetchSnapshot);
    }
    if (!force && Date.now() - lastSuccessfulFetch.current < 1500) {
      return Promise.resolve({ twin: twinRef.current, allocations: allocationsRef.current });
    }

    return fetchSnapshot();
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
      void refreshSnapshot(true).catch(() => undefined);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [pathname, refreshSnapshot]);

  return (
    <ReliefDataContext.Provider value={{ twin, allocations, loading, error, refreshSnapshot }}>
      {children}
    </ReliefDataContext.Provider>
  );
}
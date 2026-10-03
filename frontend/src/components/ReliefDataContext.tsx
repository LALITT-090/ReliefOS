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
    if (inFlight.current) return inFlight.current;
    if (!force && Date.now() - lastSuccessfulFetch.current < 1500) {
      return Promise.resolve({ twin: twinRef.current, allocations: allocationsRef.current });
    }

    const request = Promise.all([
      axios.get(`${API_BASE_URL}/v1/twin`),
      axios.get(`${API_BASE_URL}/v1/allocations`),
    ])
      .then(([twinRes, allocationRes]) => {
        const nextTwin = twinRes.data;
        const nextAllocations = allocationRes.data.allocations || [];
        twinRef.current = nextTwin;
        allocationsRef.current = nextAllocations;
        setTwin((current: any) =>
          current?.state_version === nextTwin.state_version ? current : nextTwin
        );
        setAllocations((current) =>
          JSON.stringify(current) === JSON.stringify(nextAllocations) ? current : nextAllocations
        );
        lastSuccessfulFetch.current = Date.now();
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
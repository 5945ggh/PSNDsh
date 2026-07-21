"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MockApiAdapter, mockApi } from "@/lib/mock/api";
import { ScenarioPreset } from "@/types/mock";

interface MockContextType {
  api: MockApiAdapter;
  scenario: ScenarioPreset;
  setScenario: (preset: ScenarioPreset) => void;
  version: number;
}

const MockContext = createContext<MockContextType | null>(null);

export const MockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [scenario, setScenarioState] = useState<ScenarioPreset>(
    mockApi.getScenario()
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = mockApi.subscribe(() => {
      setScenarioState(mockApi.getScenario());
      setVersion((current) => current + 1);
    });
    return unsubscribe;
  }, []);

  const setScenario = (preset: ScenarioPreset) => {
    mockApi.setScenario(preset);
  };

  return (
    <MockContext.Provider
      value={{
        api: mockApi,
        scenario,
        setScenario,
        version,
      }}
    >
      {children}
    </MockContext.Provider>
  );
};

export const useMock = () => {
  const ctx = useContext(MockContext);
  if (!ctx) {
    throw new Error("useMock must be used within a MockProvider");
  }
  return ctx;
};

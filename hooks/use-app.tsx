"use client";
import { createContext, useContext } from "react";
import { SWRConfig } from "swr";
import { useApi, BasePathProvider } from "./use-api";
import { Toaster } from "sonner";

function useAppContext({ basePath }: { basePath: string }) {
  return { basePath };
}

export const AppContext = createContext<ReturnType<typeof useAppContext> | null>(null);

export function useApp() {
  return useContext(AppContext) as ReturnType<typeof useAppContext>;
}

export const AppContextProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath: string;
}) => {
  const values = useAppContext({ basePath });
  return (
    <AppContext.Provider value={values}>
      <BasePathProvider basePath={basePath}>
        <SWRProvider>{children}</SWRProvider>
      </BasePathProvider>
    </AppContext.Provider>
  );
};

function SWRProvider({ children }: { children: React.ReactNode }) {
  const { get } = useApi();
  return (
    <SWRConfig
      value={{
        fetcher: (url) => get(url).then((res) => res),
      }}
    >
      {children}
      <Toaster />
    </SWRConfig>
  );
}
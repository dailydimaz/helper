"use client";
import { useEffect, useRef } from "react";
import { useApp } from "./use-app";

type Options = RequestInit & { noAbort?: boolean };

export const useApi = () => {
  const { basePath } = useApp();
  const abortRef = useRef<Map<AbortController, boolean>>(new Map());

  const handleOptions = (method: string, body?: any, opts?: Options) => {
    const extraHeaders = opts?.headers || {};
    const options: Options = {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...extraHeaders,
      },
      method,
      noAbort: opts?.noAbort,
    };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    return options;
  };

  const request = async (url: string, options: Options) => {
    const ctrl = new AbortController();
    if (!options.noAbort) {
      abortRef.current.set(ctrl, true);
      options.signal = ctrl.signal;
    }

    try {
      const response = await fetch(`${basePath}/api${url}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw { ...data, code: response.status };
      }

      return data;
    } finally {
      if (!options.noAbort) {
        abortRef.current.delete(ctrl);
      }
    }
  };

  return {
    get: (url: string, opts?: Options) => request(url, handleOptions("GET", null, opts)),
    post: (url: string, body?: any, opts?: Options) => request(url, handleOptions("POST", body, opts)),
    put: (url: string, body?: any, opts?: Options) => request(url, handleOptions("PUT", body, opts)),
    delete: (url: string, opts?: Options) => request(url, handleOptions("DELETE", null, opts)),
  };
};
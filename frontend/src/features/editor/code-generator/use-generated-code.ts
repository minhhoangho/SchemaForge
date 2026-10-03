"use client";

import type {
  GeneratorOptions,
  GeneratorTarget,
  SchemaDocument,
} from "@schemaforge/core";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type {
  GenerateCodeRequest,
  GenerateCodeResponse,
} from "./worker-protocol";

export type GeneratedCodeState =
  | { readonly status: "idle" }
  | {
      readonly status: "loading";
      readonly previous: GenerateCodeResponse | null;
    }
  | {
      readonly status: "ready";
      readonly response: Extract<GenerateCodeResponse, { kind: "ok" }>;
    }
  | { readonly status: "failed" };

const IDLE: GeneratedCodeState = { status: "idle" };

function createDefaultWorker(): Worker {
  return new Worker(new URL("./code-generator.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useGeneratedCode(input: {
  readonly isEnabled: boolean;
  readonly document: SchemaDocument;
  readonly target: GeneratorTarget;
  readonly options: GeneratorOptions[GeneratorTarget];
  readonly createWorker?: () => Worker;
}): GeneratedCodeState {
  const { isEnabled, document, target, options, createWorker } = input;
  const [state, setState] = useState<GeneratedCodeState>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef(0);
  const lastResponse = useRef<GenerateCodeResponse | null>(null);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const startWorker = useEffectEvent((): Worker => {
    workerRef.current ??= (createWorker ?? createDefaultWorker)();
    return workerRef.current;
  });

  useEffect(() => {
    if (!isEnabled) return;
    const worker = startWorker();
    const requestId = ++latestRequestId.current;
    const fail = (): void => {
      if (requestId === latestRequestId.current) setState({ status: "failed" });
    };
    worker.onmessage = (event: MessageEvent<GenerateCodeResponse>): void => {
      const response = event.data;
      if (response.requestId !== latestRequestId.current) return;
      lastResponse.current = response;
      setState(
        response.kind === "ok"
          ? { status: "ready", response }
          : { status: "failed" },
      );
    };
    // A worker that cannot load (missing chunk, CSP) would otherwise leave the
    // state on "loading" forever.
    worker.onerror = fail;
    worker.onmessageerror = fail;
    setState({ status: "loading", previous: lastResponse.current });
    const request: GenerateCodeRequest = {
      requestId,
      target,
      options,
      document,
    };
    worker.postMessage(request);
    return () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
    };
  }, [isEnabled, document, target, options]);

  return isEnabled ? state : IDLE;
}

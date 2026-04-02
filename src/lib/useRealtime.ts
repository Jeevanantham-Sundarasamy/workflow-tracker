"use client";

import { useEffect } from "react";
import { supabase } from "./supabase";

type Callback = (payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: any;
}) => void;

export function useRealtime(table: string, callback: Callback) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          callback({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new || {},
            old: payload.old || {},
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback]);
}

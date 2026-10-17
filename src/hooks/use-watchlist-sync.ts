import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getWatchlistSyncStatus,
  pullDeviceWatchlist,
  pushDeviceWatchlistItem,
  removeDeviceWatchlistItem,
} from "@/lib/watchlist.functions";
import {
  fromRemoteItems,
  getDeviceId,
  mergeWatchlist,
  removeBill,
  saveBill,
  type WatchItem,
} from "@/lib/watchlist";

// A failed cloud write is not fatal: the local list is the source of truth and the
// next bulk push or pull reconciles it.
const ignore = () => {};

/** True once the server reports the backend keys are set; false (this browser only) until then. */
export function useCloudSync(): boolean {
  const status = useServerFn(getWatchlistSyncStatus);
  const q = useQuery({
    queryKey: ["watchlist-sync-status"],
    queryFn: () => status(),
    staleTime: Infinity,
    retry: false,
  });
  return q.data?.cloud ?? false;
}

/** Save and remove that write locally first, then mirror to the cloud copy when it exists. */
export function useSavedBillActions() {
  const cloud = useCloudSync();
  const pushRemote = useServerFn(pushDeviceWatchlistItem);
  const removeRemote = useServerFn(removeDeviceWatchlistItem);

  const save = useCallback(
    (state: string, billNo: string, title: string) => {
      saveBill(state, billNo, title);
      const id = cloud ? getDeviceId() : "";
      if (id) {
        pushRemote({ data: { device_id: id, state, bill_no: billNo, title } }).catch(ignore);
      }
    },
    [cloud, pushRemote],
  );

  const remove = useCallback(
    (item: Pick<WatchItem, "state" | "bill_no">) => {
      removeBill(item.state, item.bill_no);
      const id = cloud ? getDeviceId() : "";
      if (id) {
        removeRemote({ data: { device_id: id, state: item.state, bill_no: item.bill_no } }).catch(
          ignore,
        );
      }
    },
    [cloud, removeRemote],
  );

  return { save, remove };
}

/** Pulls the cloud copy once per visit and merges it in. Does nothing without a backend. */
export function useCloudPullOnce(onNotice: (text: string) => void) {
  const cloud = useCloudSync();
  const pull = useServerFn(pullDeviceWatchlist);
  const done = useRef(false);
  useEffect(() => {
    if (!cloud || done.current) return;
    done.current = true;
    const id = getDeviceId();
    if (!id) return;
    pull({ data: { device_id: id } })
      .then((r) => {
        const result = mergeWatchlist(fromRemoteItems(r.items));
        if (result.added || result.merged) {
          onNotice(`Synced ${result.added} new from the cloud, ${result.merged} updated.`);
        }
      })
      .catch(ignore);
  }, [cloud, pull, onNotice]);
}

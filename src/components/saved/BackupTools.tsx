import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, ClipboardCopy, Upload, Trash2, KeyRound } from "lucide-react";
import {
  readWatchlist,
  serializeBackup,
  parseBackup,
  mergeWatchlist,
  clearWatchlist,
  getDeviceId,
  setDeviceId,
  isValidDeviceId,
  fromRemoteItems,
  type WatchItem,
  type ImportResult,
} from "@/lib/watchlist";
import { pullDeviceWatchlist, bulkPushDeviceWatchlist } from "@/lib/watchlist.functions";
import { useCloudSync } from "@/hooks/use-watchlist-sync";

/**
 * Backup and restore for saved bills. Everything lives in localStorage; when the backend is
 * configured, an opaque per-device code also keeps a cloud copy for cross-device recovery.
 */
export function BackupTools({
  items,
  onNotice,
}: {
  items: WatchItem[];
  onNotice: (text: string) => void;
}) {
  const cloud = useCloudSync();
  const [deviceId, setDeviceIdState] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pull = useServerFn(pullDeviceWatchlist);
  const bulkPush = useServerFn(bulkPushDeviceWatchlist);

  useEffect(() => {
    setDeviceIdState(getDeviceId());
  }, []);

  function doExport() {
    if (items.length === 0) {
      onNotice("Nothing to back up yet. Save a bill first.");
      return;
    }
    try {
      const blob = new Blob([serializeBackup(items)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billbreaker-saved-bills-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotice(`Downloaded a backup of ${items.length} bill${items.length === 1 ? "" : "s"}.`);
    } catch {
      onNotice("The download didn't start. Try Copy backup instead.");
    }
  }

  function copyJSON() {
    if (items.length === 0) {
      onNotice("Nothing to copy yet. Save a bill first.");
      return;
    }
    navigator.clipboard
      .writeText(serializeBackup(items))
      .then(() => onNotice("Backup copied. Paste it into a note or email to keep it."))
      .catch(() => onNotice("Your browser blocked the clipboard. Use Download backup instead."));
  }

  async function onFileSelected(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      onNotice("That file is too large (over 1 MB) to be a Bill Breaker backup.");
      return;
    }
    try {
      const result: ImportResult = mergeWatchlist(parseBackup(await file.text()));
      onNotice(
        `Restored ${result.added} new and updated ${result.merged}. You now have ${result.total} saved.`,
      );
      const id = getDeviceId();
      if (cloud && id) {
        bulkPush({ data: { device_id: id, items: readWatchlist() } }).catch(() => {
          /* reconciled on the next sync */
        });
      }
    } catch {
      onNotice("That file isn't a Bill Breaker backup.");
    }
  }

  function doClear() {
    if (items.length === 0) return;
    if (!window.confirm(`Remove all ${items.length} saved bills from this browser?`)) return;
    clearWatchlist();
    onNotice(
      cloud
        ? "Cleared on this device. The cloud copy is kept, so your code can restore it."
        : "All saved bills cleared.",
    );
  }

  function copyDeviceCode() {
    if (!deviceId) return;
    navigator.clipboard
      .writeText(deviceId)
      .then(() => onNotice("Recovery code copied. Keep it somewhere private."))
      .catch(() => onNotice("Could not copy the code."));
  }

  async function adoptCode() {
    const next = codeInput.trim().toLowerCase();
    if (!isValidDeviceId(next)) {
      onNotice("That isn't a valid recovery code.");
      return;
    }
    if (!setDeviceId(next)) {
      onNotice("Could not save the code in this browser.");
      return;
    }
    setDeviceIdState(next);
    setCodeInput("");
    setSyncing(true);
    try {
      const r = await pull({ data: { device_id: next } });
      const result = mergeWatchlist(fromRemoteItems(r.items));
      onNotice(`Code linked. Pulled ${result.added} new, ${result.merged} updated.`);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Couldn't reach the cloud copy.");
    } finally {
      setSyncing(false);
    }
  }

  const tool =
    "flex items-start gap-3 border border-border bg-background p-4 text-left hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="border border-border bg-background/70 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={doExport} disabled={items.length === 0} className={tool}>
          <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium">Download backup</span>
            <span className="block text-xs text-muted-foreground">Save a .json file</span>
          </span>
        </button>
        <button type="button" onClick={copyJSON} disabled={items.length === 0} className={tool}>
          <ClipboardCopy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium">Copy backup</span>
            <span className="block text-xs text-muted-foreground">To your clipboard</span>
          </span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={tool}>
          <Upload className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium">Restore from file</span>
            <span className="block text-xs text-muted-foreground">Merges with what's here</span>
          </span>
        </button>
        <button
          type="button"
          onClick={doClear}
          disabled={items.length === 0}
          className={tool + " hover:border-destructive hover:text-destructive"}
        >
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium">Clear all</span>
            <span className="block text-xs text-muted-foreground">Asks before deleting</span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          other devices
        </div>
        {!cloud ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            To move your saved bills to another device, download a backup here and restore it there.
            Automatic sync with a recovery code turns on once the site's backend is connected.
          </p>
        ) : (
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">This device's recovery code</div>
              <div className="mt-2 break-all bg-secondary/60 px-3 py-2 font-mono text-xs">
                {deviceId || "—"}
              </div>
              <button
                type="button"
                onClick={copyDeviceCode}
                disabled={!deviceId}
                className="mt-3 border border-border px-3 py-2 text-[11px] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-50"
              >
                Copy code
              </button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Anyone with this code can read and change your cloud copy, so keep it private.
              </p>
            </div>
            <div>
              <label htmlFor="adopt-code" className="text-sm font-medium">
                Use a code from another device
              </label>
              <input
                id="adopt-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="paste recovery code"
                className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={adoptCode}
                disabled={syncing || codeInput.trim().length === 0}
                className="mt-3 border border-border px-3 py-2 text-[11px] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Link and pull"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

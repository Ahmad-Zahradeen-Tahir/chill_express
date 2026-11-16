"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024; // matches the server limit in services/uploads.ts

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Product photo field: click or drag a photo onto the tile, see a preview, and it uploads with the form.
 * Submits as the `image` file field, so the server action is unchanged.
 */
export function PhotoPicker({ currentUrl, name = "image" }: { currentUrl: string | null; name?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ url: string; name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Placeholder artwork counts as "no photo yet".
  const existing = currentUrl && !currentUrl.startsWith("/images/placeholders/") ? currentUrl : null;
  const shown = picked?.url ?? existing;

  // Free the preview URL when it is replaced or the component unmounts.
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);

  // React resets the form after a successful save; clear the pending preview with it.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => { setPicked(null); setError(null); };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
  }

  function accept(file: File | undefined) {
    setError(null);
    if (!file) return clear();
    if (!ACCEPT.includes(file.type)) {
      clear();
      return setError("Please choose a JPG, PNG or WebP image.");
    }
    if (file.size > MAX_BYTES) {
      clear();
      return setError(`That photo is ${fmtSize(file.size)}. The limit is 4 MB.`);
    }
    setPicked({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !inputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    inputRef.current.files = dt.files; // so the dropped file is submitted with the form
    accept(file);
  }

  return (
    <div className="w-full max-w-xs">
      <p className="mb-1.5 text-sm font-semibold text-ink-2">Photo</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={shown ? "Change photo" : "Upload photo"}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-2xl text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-orange/50",
          shown ? "bg-paper ring-1 ring-line" : "border-2 border-dashed border-brand-orange/60 bg-orange-50 hover:border-brand-orange hover:bg-orange-100",
          dragging && "ring-4 ring-brand-orange",
        )}
      >
        {shown ? (
          <>
            {/* Blob previews aren't served by next/image, so use a plain img for them. */}
            {picked ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.url} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <Image src={shown} alt="" fill sizes="220px" className="object-cover" />
            )}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/55 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera className="size-6" /> Change photo
            </span>
            {picked && <span className="absolute left-2 top-2 rounded-full bg-brand-orange px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink shadow">New · not saved</span>}
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-white text-brand-red shadow-sm ring-1 ring-orange-200 transition-transform group-hover:scale-105">
              <ImagePlus className="size-6" />
            </span>
            <span className="text-sm font-semibold text-ink">{dragging ? "Drop to upload" : "Upload a photo"}</span>
            <span className="text-xs text-ink-3">Click or drag an image here</span>
          </span>
        )}
      </button>

      <input ref={inputRef} name={name} type="file" accept={ACCEPT.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => accept(e.target.files?.[0])} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          {shown ? <Camera className="size-4" /> : <ImagePlus className="size-4" />}
          {shown ? "Change photo" : "Upload photo"}
        </Button>
        {picked && (
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <RotateCcw className="size-4" /> Undo
          </Button>
        )}
      </div>
      {picked ? (
        <p className="mt-1.5 text-xs text-ink-2">
          <span className="font-semibold">{picked.name}</span> · {fmtSize(picked.size)}. It uploads when you save.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-3">JPG, PNG or WebP, up to 4 MB. Square photos look best.</p>
      )}
      {error && <p className="mt-1.5 text-xs font-semibold text-brand-red">{error}</p>}
    </div>
  );
}

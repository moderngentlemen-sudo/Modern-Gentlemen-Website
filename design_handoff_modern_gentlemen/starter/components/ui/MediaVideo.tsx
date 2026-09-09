"use client";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { InheritedMediaOverlay } from "./MediaOverlayContext";
/** Optional section treatment shares the existing positioning box and never captures input. */
export const MediaVideo = forwardRef<HTMLVideoElement, ComponentPropsWithoutRef<"video">>(
  function MediaVideo(props, ref) {
    return (
      <>
        <video {...props} ref={ref} />
        <InheritedMediaOverlay />
      </>
    );
  }
);

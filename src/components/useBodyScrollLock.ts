"use client";

import { useEffect } from "react";

/**
 * モーダルを開いておる間、背後のページをスクロールさせない。
 * スクロールバーが消えるぶんの横ずれは padding で埋める。
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);
}

"use client";

import { useEffect, useState } from "react";
import { BREAKPOINTS, type BreakpointName } from "./tokens";

/**
 * 当前命中的断点档位。
 *
 * 存在的原因：antd 的断点硬编码且无法覆盖（见 `tokens.ts` 的说明），
 * 所以 JS 侧的断点判断必须自建，并消费同一份 `BREAKPOINTS` 常量。
 *
 * 首帧返回 `base`（与服务端渲染一致，不产生 hydration 不匹配），
 * 挂载后由 effect 修正为真实档位。
 */
export function useBreakpoint(): BreakpointName {
  const [name, setName] = useState<BreakpointName>("base");

  useEffect(() => {
    const queries = Object.entries(BREAKPOINTS).map(([key, px]) => ({
      key: key as keyof typeof BREAKPOINTS,
      mql: window.matchMedia(`(min-width: ${px}px)`),
    }));

    const update = () => {
      // 取命中的最大档位
      const hit = queries.filter((q) => q.mql.matches).at(-1);
      setName(hit ? hit.key : "base");
    };

    update();
    queries.forEach((q) => q.mql.addEventListener("change", update));
    return () => queries.forEach((q) => q.mql.removeEventListener("change", update));
  }, []);

  return name;
}

/**
 * 数学核心测试：多项式求根（Durand-Kerner）与复数运算。
 *
 * 这些函数撑起根轨迹和 Bode 图。算错了页面不会报错，只会静默画出错误的
 * 曲线——所以拿有解析解的多项式对拍，而不是"跑通就算过"。
 */
import fs from "node:fs";
import { loadInline } from "./extract.mjs";

const { polyRoots, polyEvalC, C, csub, cmul, cdiv, cabs } = await loadInline(
  "const C=(re,im)",
  "const parseCoefs",
  "C, cadd, csub, cmul, cdiv, cabs, cpowi, polyEvalC, polyRoots"
);

// PID 实验：从页面现切真实的 PLANTS 与 simulate（含被控对象状态方程）
const { PLANTS, simulate } = await loadInline(
  "const PLANTS={",
  "function metrics(res)",
  "PLANTS, simulate"
);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? "  [" + extra + "]" : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? "  [" + extra + "]" : ""}`); }
};

const sortRoots = (rs) =>
  rs.map((r) => [Number(r.re.toFixed(6)), Number(r.im.toFixed(6))])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const near = (rs, expect, tol = 1e-5) => {
  const got = sortRoots(rs);
  const exp = expect.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (got.length !== exp.length) return false;
  return got.every((g, i) =>
    Math.abs(g[0] - exp[i][0]) < tol && Math.abs(g[1] - exp[i][1]) < tol);
};

console.log("[一次 / 二次]");
ok("s+2 的根是 -2", near(polyRoots([2, 1]), [[-2, 0]]));
ok("s²+3s+2 的根是 -1 和 -2", near(polyRoots([2, 3, 1]), [[-2, 0], [-1, 0]]));
ok("s²+2s+5 的根是 -1±2j", near(polyRoots([5, 2, 1]), [[-1, -2], [-1, 2]]));
ok("(s-1)² 的两个根都是 1", near(polyRoots([1, -2, 1]), [[1, 0], [1, 0]], 1e-4));

console.log("\n[三次 / 四次]");
{
  // s³-3s²+4s-4 = (s-2)(s²-s+2)，二次部分根为 0.5±(√7/2)j
  const sq7 = Math.sqrt(7) / 2;
  ok("s³-3s²+4s-4 的根是 2 与 0.5±1.3229j",
     near(polyRoots([-4, 4, -3, 1]), [[2, 0], [0.5, -sq7], [0.5, sq7]]));
}
ok("s⁴+5s²+4 的根是 ±j、±2j",
   near(polyRoots([4, 0, 5, 0, 1]), [[0, -2], [0, -1], [0, 1], [0, 2]]));
ok("(s-1)³ 三个根都收敛到 1（三阶重根是迭代法的难点）",
   near(polyRoots([-1, 3, -3, 1]), [[1, 0], [1, 0], [1, 0]], 1e-3));

console.log("\n[残差：根代回多项式应为 0]");
{
  let worst = 0;
  for (const p of [[2, 3, 1], [5, 2, 1], [-4, 4, -3, 1], [4, 0, 5, 0, 1]]) {
    for (const root of polyRoots(p)) {
      const v = polyEvalC(p, root);
      worst = Math.max(worst, Math.hypot(v.re, v.im));
    }
  }
  ok("所有根的最大残差 < 1e-6", worst < 1e-6, `实际 ${worst.toExponential(2)}`);
}

console.log("\n[退化输入不应崩]");
ok("空系数 → 空数组", polyRoots([]).length === 0);
ok("常数 → 空数组", polyRoots([5]).length === 0);
ok("末位 0 被剥离（s²+3s 的根含 0）",
   near(polyRoots([0, 3, 1]), [[-3, 0], [0, 0]], 1e-6));

console.log("\n[二阶阶跃响应回归：曾因「三次求根+slice」丢零根，13% 滑块组合整条曲线 NaN]");
{
  // 与 index.html「解析阶跃响应」同构的留数构造（含临界阻尼分支），用页面真实的 polyRoots
  const step = (zeta, wn, K = 1) => {
    const a1 = 2 * zeta * wn, a2 = wn * wn, kn = K * a2;
    const roots = polyRoots([a2, a1, 1]);
    const p1 = roots[0], p2 = roots[1];
    const distinct = Math.abs(cabs(csub(p1, p2))) > 1e-6;
    if (!distinct) {
      const p = roots[0].re;
      return (t) => { const e = Math.exp(p * t); return K * (1 - e * (1 - p * t)); };
    }
    const A = cdiv(C(kn, 0), cmul(p1, csub(p1, p2)));
    const B = cdiv(C(kn, 0), cmul(p2, csub(p2, p1)));
    const expRe = (p, t) =>
      C(Math.exp(p.re * t) * Math.cos(p.im * t), Math.exp(p.re * t) * Math.sin(p.im * t));
    return (t) => K + cmul(A, expRe(p1, t)).re + cmul(B, expRe(p2, t)).re;
  };
  let allFinite = true;
  for (let zeta = 0; zeta <= 2.001; zeta += 0.01)
    for (let wn = 0.5; wn <= 12.001; wn += 0.1) {
      const yOf = step(zeta, wn);
      for (const t of [0.5, 1, 2, 4]) if (!Number.isFinite(yOf(t))) allFinite = false;
    }
  ok("全滑块网格（23316 组合）y(t) 处处有限", allFinite);
  const y = step(0.707, 1);
  let peak = 0, tp = 0;
  for (let i = 0; i <= 6000; i++) {
    const t = i * 0.001, v = y(t);
    if (v > peak) { peak = v; tp = t; }
  }
  const sigma = (peak - 1) * 100;
  ok("ζ=0.707, ωn=1：σ% ≈ 4.33（解析值 e^(−πζ/√(1−ζ²))）",
     Math.abs(sigma - 4.33) < 0.15, `实得 ${sigma.toFixed(2)}%`);
  ok("ζ=0.707, ωn=1：tp ≈ π/ωd = 4.44 s",
     Math.abs(tp - Math.PI / Math.sqrt(1 - 0.707 ** 2)) < 0.02, `实得 ${tp.toFixed(3)} s`);
  const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf-8");
  ok("页面走二次式直接求根 polyRoots([a2,a1,1])（非三次+slice）",
     src.includes("polyRoots([a2,a1,1])") && !src.includes("polyRoots([0,a2,a1,1])"));
}

console.log("\n[PID 被控对象回归：曾因系数索引反转，把 e^-0.2s/(s+1) 仿成纯积分器]");
{
  const res = simulate(PLANTS.foptd, 1.2, 0, 0); // 纯 P 控制
  const fv = res.y[res.y.length - 1][1];
  ok("e^-0.2s/(s+1) 纯 P 控制终值 = Kp/(Kp+1) = 0.5455（有静差，与教材一致）",
     Math.abs(fv - 1.2 / 2.2) < 5e-3, `实得 ${fv.toFixed(4)}`);
  ok("IAE 有限（仿真未发散）", Number.isFinite(res.iae) && res.iae > 0);
  const res2 = simulate(PLANTS.second, 1.2, 0, 0);
  const ys = res2.y.slice(-500).map(([, y]) => y); // 末 2 s
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const osc = Math.max(...ys) - Math.min(...ys);
  ok("9/(s²+1.2s+9) 纯 P 控制为衰减振荡：末 2 s 均值 → 0.5455",
     Math.abs(mean - 1.2 / 2.2) < 0.01, `实得 ${mean.toFixed(4)}`);
  ok("末 2 s 振荡幅度 < 0.05（非等幅振荡）", osc < 0.05, `实得 ${osc.toFixed(4)}`);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

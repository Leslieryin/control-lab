/**
 * 实验 6—11 的数学核心测试：裕度穿越、Nyquist 圈数、ZOH 离散闭环、火箭物理、LQR。
 *
 * 与 math.test.mjs 同一哲学：从 index.html 现切真实源码，拿有解析解/有教材
 * 锚点的用例对拍。这些数字同时是教材《控制理论:从推导到实验》的数值锚点
 * （第 5、6、7、13、14 章），两边漂移任何一边都会在这里炸出来。
 */
import fs from "node:fs";
import { loadInline } from "./extract.mjs";

const M = await loadInline(
  "const C=(re,im)",
  "画布工具（HiDPI",
  [
    "C", "cadd", "csub", "cmul", "cdiv", "cabs",
    "polyEvalC", "polyRoots", "buildRealPoly",
    "bodeSweep", "marginCrossings", "nyquistContourData",
    "lamOf", "kcZOH", "discreteChar", "discreteRoots", "discreteSim",
    "rocketPID", "simulateLanding",
    "lqrDI", "lqrStep", "lqrLoopPM",
  ].join(", ")
);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}${extra ? "  [" + extra + "]" : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? "  [" + extra + "]" : ""}`); }
};
const close = (got, want, tol) => Math.abs(got - want) <= tol;

console.log("[实验 6：buildRealPoly 与 Bode 裕度]");
{
  const poly = M.buildRealPoly([M.C(-1, 0), M.C(-2, 0), M.C(-5, 0)]);
  ok("(s+1)(s+2)(s+5) 升幂系数 = [10,17,8,1]",
     JSON.stringify(poly) === JSON.stringify([10, 17, 8, 1]),
     `实得 ${JSON.stringify(poly)}`);

  // 教材锚点：L = 20/((s+1)(s+2)(s+5))，劳斯临界增益 Kcrit = 8·17 − 10 = 126
  const { ws, mags, phases } = M.bodeSweep([20], [10, 17, 8, 1], 1e-2, 1e3, 2000);
  const { wgc, pm, wpc, gm } = M.marginCrossings(ws, mags, phases);
  ok("直流增益 20/10 = 2 → 低频幅值 ≈ 6.02 dB", close(mags[0], 6.02, 0.02), `实得 ${mags[0].toFixed(3)}`);
  // ωgc：解 (1+ω²)(4+ω²)(25+ω²) = 400 → ω ≈ 1.28
  ok("ωgc ≈ 1.28 rad/s", wgc !== null && close(wgc, 1.28, 0.04), `实得 ${wgc?.toFixed(3)}`);
  ok("PM ≈ 81°（180 − arctan1.28 − arctan0.64 − arctan0.256）",
     pm !== null && close(pm, 81, 2), `实得 ${pm?.toFixed(2)}`);
  // ωpc = √17（三因子相位和恰为 −180°），GM = 20lg(126/20) = 20lg6.3 ≈ 16.0 dB
  ok("ωpc = √17 ≈ 4.123 rad/s", wpc !== null && close(wpc, Math.sqrt(17), 0.05),
     `实得 ${wpc?.toFixed(4)}（理论 ${Math.sqrt(17).toFixed(4)}）`);
  ok("GM = 20lg(126/20) ≈ 16.0 dB", gm !== null && close(gm, 20 * Math.log10(6.3), 0.3),
     `实得 ${gm?.toFixed(2)}`);
}

console.log("\n[实验 7：Nyquist 圈数 Z = N + P]");
{
  // 教材例 6.1：L = 12/((s+1)(s+2)(s+3))，Kc = 60（系数升幂，低次在前）
  const den = [6, 11, 6, 1];
  let d = M.nyquistContourData([12], den, 1, 6, 1200);
  ok("K=12：N ≈ 0（不包围 −1，闭环稳定）", Math.abs(d.N) < 0.05, `实得 N = ${d.N.toFixed(3)}`);
  d = M.nyquistContourData([80], den, 1, 6, 1200);
  ok("K=80：N ≈ +2（顺时针两圈，Z=2，与劳斯两次变号一致）", Math.abs(d.N - 2) < 0.1, `实得 N = ${d.N.toFixed(3)}`);
  // 教材例 6.2：L = K(s? 无零点)…此处为 K/((s−1)(s+2)(s+3))，P = 1
  const denU = [-6, 1, 4, 1]; // (s−1)(s+2)(s+3)
  d = M.nyquistContourData([8], denU, 1, 6, 1200);
  ok("K=8（P=1）：N ≈ −1（逆时针一圈，Z = 0 稳定）", Math.abs(d.N + 1) < 0.1, `实得 N = ${d.N.toFixed(3)}`);
  d = M.nyquistContourData([12], denU, 1, 6, 1200);
  ok("K=12（P=1）：N ≈ +1（Z = 2，教材习题 6.2）", Math.abs(d.N - 1) < 0.1, `实得 N = ${d.N.toFixed(3)}`);
}

console.log("\n[实验 10：ZOH 离散闭环（教材第 13 章锚点）]");
{
  const T = 1, lam = M.lamOf(T);
  ok("e^{−1} = 0.368", close(lam, 0.368, 5e-4), `实得 ${lam.toFixed(4)}`);
  ok("Kc = (1+e^{−1})/(1−e^{−1}) ≈ 2.164", close(M.kcZOH(lam), 2.164, 1e-3), `实得 ${M.kcZOH(lam).toFixed(4)}`);
  const y = M.discreteSim(lam, T, 1, 0, 5);
  const want = [0.632, 0.465, 0.509, 0.498, 0.501];
  ok("Kp=1, T=1：序列 0.632→0.465→0.509→0.498→0.501（例 13.1 隔拍振铃）",
     y.slice(1).every((v, i) => close(v, want[i], 1e-3)),
     `实得 ${y.slice(1).map(v => v.toFixed(3)).join(",")}`);
  ok("终值 = 0.5（直流增益经 ZOH 保留）", close(y[5], 0.5, 1e-3), `实得 ${y[5].toFixed(4)}`);
  const rP = M.discreteRoots(lam, T, 1, 0);
  ok("Ki=0：单一闭环极点 −0.264（一阶特征，无 z=1 控制器残根）",
     rP.length === 1 && close(rP[0].re, -0.264, 1e-3) && Math.abs(rP[0].im) < 1e-9,
     `实得 ${rP.map(r => r.re.toFixed(4)).join(",")}`);

  // 数字 PI 稳定三角形（例 13.2：Kp=1、T=1 时 Ki < 2.33）
  const lim = (2 / T) * (M.kcZOH(lam) - 1);
  ok("Ki 上限 ≈ 2.33", close(lim, 2.329, 5e-3), `实得 ${lim.toFixed(4)}`);
  const rIn = M.discreteRoots(lam, T, 1, 2).map(r => [r.re, r.im]).sort((a, b) => a[0] - b[0]);
  ok("Ki=2：极点 0.314 与 −0.842（圆内，稳）",
     close(rIn[0][0], -0.8417, 1e-3) && close(rIn[1][0], 0.3137, 1e-3) && rIn.every(([re, im]) => Math.hypot(re, im) < 1),
     `实得 ${rIn.map(([re, im]) => `${re.toFixed(3)}${im ? "±" + Math.abs(im).toFixed(3) + "j" : ""}`).join(", ")}`);
  const rOut = M.discreteRoots(lam, T, 1, 2.5);
  ok("Ki=2.5：存在 |z|>1 的极点（越线发散）", rOut.some(r => Math.hypot(r.re, r.im) > 1),
     `实得 |z| = ${rOut.map(r => Math.hypot(r.re, r.im).toFixed(3)).join(", ")}`);
  ok("T=0.5：Kc ≈ 4.08（采样越快预算越宽）", close(M.kcZOH(M.lamOf(0.5)), 4.083, 5e-3),
     `实得 ${M.kcZOH(M.lamOf(0.5)).toFixed(3)}`);
}

console.log("\n[实验 9：火箭物理与 PID]");
{
  const good = M.simulateLanding(1.5, 0, 6);
  ok("默认增益 (1.5, 0, 6)：软着陆且 |v| < 3 m/s",
     good.landed && good.vImpact < 3, `实得 |v| = ${good.vImpact?.toFixed(2)} m/s, t = ${good.t.toFixed(1)} s`);
  const free = M.simulateLanding(0, 0, 0);
  ok("零增益：自由落体坠毁，|v| ≈ √(2g·100) ≈ 44.3 m/s",
     free.landed && free.vImpact > 40, `实得 |v| = ${free.vImpact?.toFixed(2)} m/s`);
  const windup = M.simulateLanding(1.5, 0.8, 6);
  ok("Ki=0.8：积分攒「催落」的账，明显更重（|v| > 软着陆线）",
     windup.landed && windup.vImpact > good.vImpact + 0.5,
     `实得 |v| = ${windup.vImpact?.toFixed(2)} m/s`);
  ok("推力只能向上：u 恒在 [0, 30]",
     good.log.every(([, , , u]) => u >= 0 && u <= 30));
  ok("rocketPID 限幅：D 项爆冲时输出顶到 30、反向误差压到 0",
     M.rocketPID(0, 0, -1000, 0, 0, 1, 0.01, 30) === 30 &&
     M.rocketPID(-1000, 0, -1000, 1, 0, 0, 0.01, 30) === 0);
}

console.log("\n[实验 11：双积分器 LQR（教材第 14 章锚点）]");
{
  const d = M.lqrDI(1, 1, 1);
  ok("Q=I, R=1：K = [1, √3]（例 14.1 闭式解）",
     close(d.K[0], 1, 1e-9) && close(d.K[1], Math.sqrt(3), 1e-9),
     `实得 [${d.K.map(v => v.toFixed(6)).join(", ")}]`);
  ok("P = [[√3,1],[1,√3]]（ARE 闭式解,J(x₀=e₁)=√3）",
     close(d.P[0], Math.sqrt(3), 1e-9) && close(d.P[1], 1, 1e-9) && close(d.P[2], Math.sqrt(3), 1e-9),
     `实得 [${d.P.map(v => v.toFixed(6)).join(", ")}]`);
  const roots = M.polyRoots([1, Math.sqrt(3), 1]).map(r => [r.re, r.im]).sort((a, b) => a[1] - b[1]);
  ok("闭环极点 −0.866 ± 0.5j（ζ = 0.866,|s| = 1）",
     close(roots[0][0], -0.8660254, 1e-4) && close(Math.abs(roots[0][1]), 0.5, 1e-4) &&
     Math.hypot(roots[0][0], roots[0][1]) - 1 < 1e-9,
     `实得 ${roots.map(([re, im]) => `${re.toFixed(4)}${im >= 0 ? "+" : ""}${im.toFixed(4)}j`).join(", ")}`);
  ok("ζ = √3/2,Mp ≈ 0.43%（几乎无超调）",
     close(Math.sqrt(3) / 2, 0.8660254, 1e-6) && close(M.lqrStep(d.K, 100).y, 1, 1e-9),
     `终值 y(∞) = ${M.lqrStep(d.K, 100).y.toFixed(6)}`);

  const pm = M.lqrLoopPM(d.K);
  ok("PM ≈ 72.4°（≥ 60° 定理下界）", close(pm.pm, 72.38, 0.1) && pm.pm >= 60,
     `实得 ${pm.pm.toFixed(2)}° @ ωgc = ${pm.wgc.toFixed(4)}`);
  const pmBW = M.lqrLoopPM(M.lqrDI(1, 0, 1).K);
  ok("q₂ = 0：PM ≈ 65.5°,仍 ≥ 60°", close(pmBW.pm, 65.53, 0.1), `实得 ${pmBW.pm.toFixed(2)}°`);
  const pmHi = M.lqrLoopPM(M.lqrDI(1, 1, 0.1).K);
  ok("r = 0.1：PM ≈ 79.2°", close(pmHi.pm, 79.23, 0.1), `实得 ${pmHi.pm.toFixed(2)}°`);
  const pmLo = M.lqrLoopPM(M.lqrDI(1, 1, 10).K);
  ok("r = 10：PM ≈ 68.2°,权重怎么拖都出不了 60° 圈",
     close(pmLo.pm, 68.16, 0.1) && pmLo.pm >= 60, `实得 ${pmLo.pm.toFixed(2)}°`);

  const bw = M.lqrDI(1, 0, 1);
  ok("q₂ = 0：K = [1, √2],巴特沃斯角 ζ = 0.707(极点 −0.707±0.707j)",
     close(bw.K[1], Math.SQRT2, 1e-9) && close(bw.K[1] / (2 * Math.sqrt(bw.K[0])), Math.SQRT1_2, 1e-9),
     `实得 K = [${bw.K.map(v => v.toFixed(6)).join(", ")}]`);
  const ag = M.lqrDI(1, 1, 0.1);
  const agR = M.polyRoots([ag.K[0], ag.K[1], 1]).map(r => r.re).sort((a, b) => a - b);
  ok("r = 0.1：K ≈ [3.162, 4.040],极点上实轴分手 −1.06 / −2.98(过阻尼)",
     close(ag.K[0], 3.1622777, 1e-4) && close(ag.K[1], 4.0403665, 1e-4) &&
     close(agR[0], -2.9787553, 1e-4) && close(agR[1], -1.0616104, 1e-4),
     `实得 K = [${ag.K.map(v => v.toFixed(4)).join(", ")}],极点 ${agR.map(v => v.toFixed(4)).join(", ")}`);
  const so = M.lqrDI(1, 1, 10);
  ok("r = 10：K ≈ [0.316, 0.856](控制变贵,收敛放缓)",
     close(so.K[0], 0.3162278, 1e-4) && close(so.K[1], 0.8558361, 1e-4),
     `实得 [${so.K.map(v => v.toFixed(4)).join(", ")}]`);
  ok("lqrStep 三分支自洽:临界阻尼(q₂=2,q₁=r=1)终值仍为 1",
     close(M.lqrStep(M.lqrDI(1, 2, 1).K, 80).y, 1, 1e-9) &&
     close(M.lqrStep(M.lqrDI(1, 1, 0.1).K, 80).y, 1, 1e-9));
  ok("u(0+) = k₁(油钱起步价):r=1 时为 1,r=0.1 时为 √10",
     close(M.lqrStep(d.K, 0).u, 1, 1e-9) && close(M.lqrStep(ag.K, 0).u, Math.sqrt(10), 1e-9),
     `实得 ${M.lqrStep(d.K, 0).u.toFixed(4)} / ${M.lqrStep(ag.K, 0).u.toFixed(4)}`);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

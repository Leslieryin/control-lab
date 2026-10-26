/**
 * 数学核心测试：多项式求根（Durand-Kerner）与复数运算。
 *
 * 这些函数撑起根轨迹和 Bode 图。算错了页面不会报错，只会静默画出错误的
 * 曲线——所以拿有解析解的多项式对拍，而不是"跑通就算过"。
 */
import { loadInline } from "./extract.mjs";

const { polyRoots, polyEvalC } = await loadInline(
  "const C=(re,im)",
  "const parseCoefs",
  "C, cadd, csub, cmul, cdiv, cabs, cpowi, polyEvalC, polyRoots"
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

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);

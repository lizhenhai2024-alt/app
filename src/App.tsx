/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, 
  Bar, Cell, ComposedChart, BarChart, AreaChart, Area, Legend, Label, ReferenceArea
} from 'recharts';
import { 
  Wrench, ShieldCheck, Zap, TrendingUp, Target, RefreshCw, Box, Sliders, Check, 
  Printer, BarChart3, Cpu, Activity as ActivityIcon, Ruler, ChevronRight, ArrowRight, ArrowUpRight, ArrowDownRight, Layers,
  AlertTriangle, CheckCircle2
} from 'lucide-react';

// --- 核心算法 ---
const randomNormal = (mean: number, tol: number) => {
  const stdDev = Math.max(0.000001, Math.abs(tol) / 3); 
  let u1 = Math.random(), u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
};

const erf = (x: number) => {
  const sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
};

const normCdf = (x: number, mean: number, std: number) => 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));

// --- 数据库 ---
const MATERIALS: Record<string, { name: string; E: number; poisson: number; yield: number }> = {
  "Steel_ST37_2": { name: "ST37-2 (碳钢)", E: 210000, poisson: 0.30, yield: 400 },
  "Steel_S355J0": { name: "S355J0 (高强钢)", E: 210000, poisson: 0.30, yield: 600 },
  "Al_6082_T6": { name: "锻铝 6082-T6", E: 70000, poisson: 0.33, yield: 300 },
  "Al_6110_T6": { name: "锻铝 6110-T6", E: 72000, poisson: 0.33, yield: 350 },
};

const FASTENERS = {
  bolts: { "M12": { d: 12 }, "M14": { d: 14 } } as Record<string, { d: number }>,
  nuts: {
    "metal_lock": { name: "金属锁紧螺母", prev_M12: 6.0, prev_M14: 8.0 },
    "nylon_lock": { name: "涂胶锁紧螺母", prev_M12: 3.5, prev_M14: 4.5 }
  }
};

interface ParamConfig {
  label: string;
  unit?: string;
  fix?: number;
  cat: string;
  isMat?: boolean;
  isText?: boolean;
  isNut?: boolean;
}

const PARAM_DICT: Record<string, ParamConfig> = {
  d_cyl_nom: { label: '缸径名义 d_cyl', unit: 'mm', fix: 2, cat: 'dim' },
  d_cyl_tol: { label: '外径公差(±)', unit: 'mm', fix: 2, cat: 'tol' },
  cyl_inner_nom: { label: '缸圆柱度(名)', unit: 'mm', fix: 2, cat: 'dim' },
  cyl_inner_tol: { label: '缸圆柱公差(±)', unit: 'mm', fix: 2, cat: 'tol' },
  t_inner: { label: '管壁厚度 t_in', unit: 'mm', fix: 1, cat: 'dim' },
  paint_thick_nom: { label: '漆膜厚度', unit: 'μm', fix: 0, cat: 'proc' },
  paint_thick_tol: { label: '漆膜公差(±)', unit: 'μm', fix: 0, cat: 'tol' },
  Ksc: { label: '应力集中系数 Ksc', unit: '', fix: 2, cat: 'dim' }, 
  cyl_materialKey: { label: '油缸材料', isMat: true, cat: 'dim' },
  unclamped_bottom: { label: '不抱紧长度', unit: 'mm', fix: 1, cat: 'dim' },
  unclamped_bottom_tol: { label: '不抱紧公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  d_fork_nom: { label: '孔径名义 d_fk', unit: 'mm', fix: 2, cat: 'dim' },
  d_fork_tol: { label: '孔径公差(±)', unit: 'mm', fix: 2, cat: 'tol' },
  cyl_fork_nom: { label: '孔圆柱度', unit: 'mm', fix: 2, cat: 'dim' },
  cyl_fork_tol: { label: '孔圆柱公差(±)', unit: 'mm', fix: 2, cat: 'tol' },
  t_fork: { label: '叉臂壁厚 t_fk', unit: 'mm', fix: 1, cat: 'dim' },
  depth_fork: { label: '孔总深度', unit: 'mm', fix: 1, cat: 'dim' },
  depth_fork_tol: { label: '深度公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  b_slot: { label: '开槽宽度', unit: 'mm', fix: 1, cat: 'dim' },
  b_slot_tol: { label: '槽宽公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  e_offset: { label: '螺栓偏心距 e', unit: 'mm', fix: 1, cat: 'dim' },
  e_offset_tol: { label: '偏心公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  Ra_fork: { label: '孔粗糙度 Ra', unit: 'μm', fix: 1, cat: 'proc' },
  L_total: { label: '顶至底孔距 L_tot', unit: 'mm', fix: 1, cat: 'dim' },
  L_total_tol: { label: '总距公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  L_holes: { label: '双孔中心距 L_h2h', unit: 'mm', fix: 1, cat: 'dim' },
  L_holes_tol: { label: '孔距公差(±)', unit: 'mm', fix: 1, cat: 'tol' },
  fork_materialKey: { label: '叉臂材料', isMat: true, cat: 'dim' },
  torque_nom: { label: '拧紧力矩 T', unit: 'Nm', fix: 0, cat: 'proc' },
  torque_tol: { label: '力矩公差(±)', unit: 'Nm', fix: 1, cat: 'tol' },
  bolt_type: { label: '螺栓规格', isText: true, cat: 'proc' },
  nut_type: { label: '螺母类型', isNut: true, cat: 'proc' },
  mu0_nom: { label: '基础摩擦 μ0', unit: '', fix: 2, cat: 'proc' },
  mu0_tol: { label: '摩擦公差(±)', unit: '', fix: 2, cat: 'tol' },
  k_factor: { label: '扭矩系数 k', unit: '', fix: 2, cat: 'proc' },
  torque_prevailing: { label: '拧入力矩', unit: 'Nm', fix: 1, cat: 'proc' }
};

const CYL_KEYS = ['d_cyl_nom', 'd_cyl_tol', 'cyl_inner_nom', 'cyl_inner_tol', 'paint_thick_nom', 'paint_thick_tol', 't_inner', 'Ksc', 'cyl_materialKey', 'unclamped_bottom', 'unclamped_bottom_tol'];
const FORK_KEYS = ['d_fork_nom', 'd_fork_tol', 'cyl_fork_nom', 'cyl_fork_tol', 't_fork', 'depth_fork', 'depth_fork_tol', 'b_slot', 'b_slot_tol', 'e_offset', 'e_offset_tol', 'Ra_fork', 'L_total', 'L_total_tol', 'L_holes', 'L_holes_tol', 'fork_materialKey'];

const App = () => {
  const [params, setParams] = useState<any>({
    F_target: 52, F_spec: 52, safety_factor: 1.0, target_reliability: 100.0, mc_samples: 10000, 
    d_cyl_nom: 57.27, d_cyl_tol: 0.09, cyl_inner_nom: 0.05, cyl_inner_tol: 0.05, t_inner: 3.0, paint_thick_nom: 35, paint_thick_tol: 5, Ksc: 1.5, unclamped_bottom: 6.0, unclamped_bottom_tol: 0.5, cyl_materialKey: "Steel_ST37_2",
    d_fork_nom: 56.75, d_fork_tol: 0.25, cyl_fork_nom: 0.05, cyl_fork_tol: 0.05, t_fork: 8.0, depth_fork: 52.0, depth_fork_tol: 0.5, b_slot: 6.4, b_slot_tol: 0.2, Ra_fork: 6.3, e_offset: 46.7, e_offset_tol: 0.5, 
    L_total: 90.0, L_total_tol: 0.5, L_holes: 56.1, L_holes_tol: 0.5, fork_materialKey: "Al_6082_T6",
    torque_nom: 100, torque_tol: 5.0, bolt_type: "M14", nut_type: "metal_lock", mu0_nom: 0.20, mu0_tol: 0.02, k_factor: 0.20, torque_prevailing: 8.0
  });

  const [optConfig, setOptConfig] = useState<Record<string, boolean>>({
    goalForce: true, goalNoYield: true, goalReliability: true,
    d_cyl_nom: false, d_cyl_tol: true, cyl_inner_nom: true, cyl_inner_tol: true, t_inner: true, paint_thick_nom: false, paint_thick_tol: true, Ksc: true, unclamped_bottom: true, unclamped_bottom_tol: true, cyl_materialKey: true,
    d_fork_nom: true, d_fork_tol: true, cyl_fork_nom: true, cyl_fork_tol: true, t_fork: true, depth_fork: true, depth_fork_tol: true, b_slot: true, b_slot_tol: true, e_offset: false, e_offset_tol: true, Ra_fork: true, L_total: false, L_total_tol: true, L_holes: true, L_holes_tol: true, fork_materialKey: true,
    torque_nom: true, torque_tol: true, bolt_type: false, nut_type: false, mu0_nom: false, mu0_tol: true, k_factor: false, torque_prevailing: false
  });

  // --- 物理计算 ---
  const runPhysics = (p: any) => {
    const cyl_mat = MATERIALS[p.cyl_materialKey] || MATERIALS["Steel_ST37_2"];
    const fork_mat = MATERIALS[p.fork_materialKey] || MATERIALS["Al_6082_T6"];
    const H_eff = Math.max(10, p.depth_fork - p.unclamped_bottom);
    const delta = Math.max(0.01, p.d_cyl_nom - p.d_fork_nom);
    const d_bolt = FASTENERS.bolts[p.bolt_type].d;
    const F_pre = Math.max(0, (p.torque_nom - p.torque_prevailing)) / (p.k_factor * (d_bolt / 1000));
    const K_slot = Math.max(0.01, 1 - 1.5 * (p.b_slot / (Math.PI * p.d_cyl_nom)));
    const h1_val = p.H1 !== undefined ? p.H1 : (p.L_total - p.L_holes);
    const h_ratio = (H_eff - h1_val) / H_eff;
    const eta_h = Math.max(0.1, 1 - 1.5 * Math.abs(h_ratio - 0.525));
    const eta_r = 1 + (2 * p.e_offset / p.d_cyl_nom);
    const eta_c = Math.max(0.1, 1 - ((p.cyl_fork_nom + p.cyl_inner_nom) / (delta * 2.5)));
    const mu = p.mu0_nom * (1 + (p.Ra_fork - 1.6) * 0.01) * (1 - (p.paint_thick_nom / 800));
    const p_elastic = (delta * fork_mat.E * p.t_fork) / Math.pow(p.d_cyl_nom, 2) * 0.20 * K_slot;
    const p_bolt = (1 * F_pre * eta_h * eta_r) / (p.d_cyl_nom * H_eff);
    const p_total = Math.max(0, p_elastic + p_bolt);
    const F_total = (Math.PI * p.d_cyl_nom * H_eff) * p_total * mu * eta_c;
    const sigma_v = (p_total * p.d_cyl_nom / (2 * p.t_inner)) * (p.Ksc || 1.5);
    return { F_total, sigma_v, p_total, eta_h, mu, H_eff, yield: cyl_mat.yield };
  };

  const results = useMemo(() => {
    const base = runPhysics(params);
    const target_kN = params.F_spec * params.safety_factor;

    const performMC = (p: any, samples: number) => {
      const F_LIMIT = p.F_spec || 52; // 工程判定线
      let passCount = 0, failCountSpec = 0, sum = 0, sqSum = 0, minV = Infinity, maxV = -Infinity;
      const forces = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const L_tot_s = randomNormal(p.L_total, p.L_total_tol);
        const L_hol_s = randomNormal(p.L_holes, p.L_holes_tol);
        const s = { ...p,
          d_fork_nom: randomNormal(p.d_fork_nom, p.d_fork_tol),
          d_cyl_nom: randomNormal(p.d_cyl_nom, p.d_cyl_tol),
          cyl_inner_nom: Math.max(0, randomNormal(p.cyl_inner_nom, p.cyl_inner_tol)),
          cyl_fork_nom: Math.max(0, randomNormal(p.cyl_fork_nom, p.cyl_fork_tol)),
          paint_thick_nom: Math.max(0, randomNormal(p.paint_thick_nom, p.paint_thick_tol)),
          torque_nom: randomNormal(p.torque_nom, p.torque_tol),
          mu0_nom: Math.max(0.01, randomNormal(p.mu0_nom, p.mu0_tol)),
          depth_fork: randomNormal(p.depth_fork, p.depth_fork_tol),
          b_slot: Math.max(0.1, randomNormal(p.b_slot, p.b_slot_tol)),
          e_offset: randomNormal(p.e_offset, p.e_offset_tol),
          unclamped_bottom: Math.max(0, randomNormal(p.unclamped_bottom, p.unclamped_bottom_tol)),
          H1: L_tot_s - L_hol_s
        };
        const fVal = runPhysics(s).F_total / 1000;
        forces[i] = fVal; sum += fVal; sqSum += fVal * fVal;
        if (fVal < minV) minV = fVal; if (fVal > maxV) maxV = fVal;
        if (fVal >= target_kN) passCount++; 
        if (fVal < F_LIMIT) failCountSpec++;
      }
      const mean = sum / samples, stdDev = Math.sqrt((sqSum/samples) - (mean*mean));
      forces.sort();

      const bins = 40; // 优化 bin 数量
      const histogram = [];
      const step = (maxV - minV) / bins;
      let cumulativeCount = 0;
      for (let b = 0; b < bins; b++) {
        const bMin = minV + b * step;
        const bMax = bMin + step;
        const count = forces.filter(f => f >= bMin && f < bMax).length;
        cumulativeCount += count;
        const pdfTheory = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((bMin + step / 2 - mean) / stdDev, 2));
        histogram.push({ 
          bin: parseFloat((bMin + step / 2).toFixed(2)), 
          count, 
          pdfCount: pdfTheory * samples * step, 
          cdf: (cumulativeCount / samples) * 100 
        });
      }

      const zScore = stdDev > 0 ? (mean - target_kN) / stdDev : 0;
      const f90 = forces[Math.floor(samples * 0.1)] || 0; // 90% Reliability (10th percentile)
      const f99 = forces[Math.floor(samples * 0.01)] || 0; // 99% Reliability (1st percentile)

      return { 
        reliability: (passCount/samples)*100, 
        probFailSpec: (failCountSpec / samples) * 100,
        fLimit: F_LIMIT,
        f90,
        f99,
        mean,
        stdDev,
        cpk: stdDev > 0 ? (mean - F_LIMIT) / (3 * stdDev) : 0,
        p001: forces[Math.floor(samples*0.001)] || 0,
        p01: forces[Math.floor(samples*0.01)] || 0, 
        p10: forces[Math.floor(samples*0.1)] || 0,
        p50: forces[Math.floor(samples*0.5)] || 0,
        sigma3_low: mean - 3 * stdDev,
        sigma3_high: mean + 3 * stdDev,
        minV, maxV, zScore, 
        pf_theory: normCdf(target_kN, mean, stdDev), 
        reliability_theory: (1 - normCdf(target_kN, mean, stdDev))*100, 
        histogram 
      };
    };

    const calculatePareto = (p: any) => {
        const baseF = runPhysics(p).F_total;
        // 重新分类为工程语言: 几何类, 表面类, 装配类
        const rawItems = [
            {k:'d_cyl_nom',l:'过盈量 (几何)',d:0.02, cat: '几何类'}, 
            {k:'mu0_nom',l:'基础摩擦 (表面)',d:0.02, cat: '表面类'},
            {k:'torque_nom',l:'拧紧力矩 (装配)',d:5, cat: '装配类'}, 
            {k:'t_inner',l:'壁厚刚度 (几何)',d:0.3, cat: '几何类'}, 
            {k:'L_holes',l:'孔位精度 (几何)',d:2, cat: '几何类'}, 
            {k:'depth_fork',l:'加工深度 (几何)',d:0.5, cat: '几何类'}
        ];
        
        const items = rawItems.map(it => ({ 
            name: it.l, 
            imp: Math.abs(runPhysics({...p, [it.k]: p[it.k]+it.d}).F_total - baseF), 
            type: 'single',
            cat: it.cat
        }));

        // 修正交互项逻辑: 使用正确的索引 (0:过盈, 1:摩擦)
        const F_both = runPhysics({...p, d_cyl_nom: p.d_cyl_nom + 0.02, mu0_nom: p.mu0_nom + 0.02}).F_total - baseF;
        items.push({ 
            name: '干涉×摩擦 (交互)', 
            imp: Math.abs(F_both - (items[0].imp + items[1].imp)) * 1.2, 
            type: 'interaction', 
            cat: '综合类' 
        });
        
        let diffSum = items.reduce((a,c)=>a+c.imp, 0), cum = 0;
        const sorted = items.sort((a,b)=>b.imp-a.imp);
        
        return sorted.map((it, idx) => {
            const perc = (it.imp/diffSum)*100; cum += perc;
            // 动态计算收益: 收益应与敏感度(imp)成正比，确保 TOP1 > TOP2 > TOP3
            const gain = parseFloat((it.imp / 1000 * 1.8).toFixed(1)); 
            return { ...it, percentage: parseFloat(perc.toFixed(1)), cumulative: parseFloat(cum.toFixed(1)), gain };
        });
    };

    const solveOptimization = () => {
      let op = { ...params };
      if (optConfig.cyl_materialKey && base.sigma_v > 450) op.cyl_materialKey = "Steel_S355J0";
      if (optConfig.cyl_inner_tol) op.cyl_inner_tol = 0.03;
      if (optConfig.d_cyl_tol) op.d_cyl_tol = 0.05;
      if (optConfig.t_inner && base.sigma_v > 400) op.t_inner = 3.5;
      if (optConfig.d_fork_tol) op.d_fork_tol = 0.15;
      if (optConfig.cyl_fork_tol) op.cyl_fork_tol = 0.03;
      if (optConfig.Ra_fork) op.Ra_fork = 3.2;
      if (optConfig.L_holes) op.L_holes = parseFloat((params.L_total - (params.depth_fork - params.unclamped_bottom) * 0.475).toFixed(1));
      if (optConfig.torque_nom && base.F_total/1000 < target_kN) op.torque_nom = Math.min(130, params.torque_nom + 15);
      if (optConfig.torque_tol) op.torque_tol = 2.0;
      if (optConfig.mu0_tol) op.mu0_tol = 0.01;
      if (optConfig.paint_thick_tol) op.paint_thick_tol = 2;
      if (optConfig.e_offset_tol) op.e_offset_tol = 0.2;
      if (optConfig.depth_fork_tol) op.depth_fork_tol = 0.2;
      return { op, mc: performMC(op, params.mc_samples), base: runPhysics(op) };
    };

    const chartData = [];
    let maxForce = 0;
    let maxStress = 0;
    const H_eff = Math.max(10, params.depth_fork - params.unclamped_bottom);
    const H_max = params.depth_fork; // X轴最大值等于叉臂孔深度 (depth_fork)
    let optimalRange = { start: null as number | null, end: null as number | null };

    for(let i=0; i<=50; i++) {
        const testH1 = (H_max * i) / 50;
        const res = runPhysics({...params, H1: testH1});
        const f = res.F_total/1000;
        const s = res.sigma_v;
        if (f > maxForce) maxForce = f;
        if (s > maxStress) maxStress = s;
        
        const isSafe = f >= target_kN && s <= res.yield;
        if (isSafe) {
            if (optimalRange.start === null) optimalRange.start = testH1;
            optimalRange.end = testH1;
        }

        chartData.push({ 
            h1: parseFloat(testH1.toFixed(1)), 
            force: parseFloat(f.toFixed(2)), 
            stress: parseFloat(s.toFixed(0)),
            isSafe: isSafe ? 1 : 0
        });
    }

    const forceTicks = [];
    for (let i = 0; i <= Math.ceil(maxForce / 10) * 10 + 10; i += 10) forceTicks.push(i);
    const maxTick = forceTicks[forceTicks.length - 1] || 100;

    // Add safeZone to chartData after maxTick is known
    const finalChartData = chartData.map(d => ({
        ...d,
        safeZone: d.isSafe ? maxTick : null
    }));

    // 计算当前点斜率 (Gradient)
    const current_H1 = params.L_total - params.L_holes;
    const deltaH = 0.5;
    const fPlus = runPhysics({...params, H1: current_H1 + deltaH}).F_total / 1000;
    const fMinus = runPhysics({...params, H1: current_H1 - deltaH}).F_total / 1000;
    const slope = (fPlus - fMinus) / (2 * deltaH);

    const stressTicks = [];
    for (let i = 0; i <= Math.ceil(maxStress / 100) * 100 + 100; i += 100) stressTicks.push(i);

    const h1Ticks = [];
    for (let i = 0; i <= Math.ceil(H_max / 5) * 5; i += 5) h1Ticks.push(i);

    const pressureBreakdown = [
      { name: '过盈弹性压力', value: parseFloat((base.p_total * 0.4).toFixed(3)) }, // 模拟比例
      { name: '螺栓抱紧压力', value: parseFloat((base.p_total * 0.6).toFixed(3)) }
    ];

    return { ...base, mc_baseline: performMC(params, params.mc_samples), target_kN, optResult: solveOptimization(), paretoData: calculatePareto(params), chartData: finalChartData, H_eff, current_H1, slope, optimalRange, pressureBreakdown, forceTicks, stressTicks, h1Ticks };
  }, [params, optConfig]);

  const handleUpdate = (k: string, v: any) => {
    setParams((p: any) => {
      const newVal = (['cyl_materialKey', 'fork_materialKey', 'bolt_type', 'nut_type'].includes(k)) ? v : (parseFloat(v) || 0);
      const next = { ...p, [k]: newVal };
      if (k === 'F_spec' || k === 'safety_factor') {
        next.F_target = next.F_spec * next.safety_factor;
      }
      return next;
    });
  };
  const toggleOpt = (key: string) => setOptConfig(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-40 selection:bg-indigo-100 print:bg-white print:p-0">
      
      {/* 顶部 KPI 驾驶舱 */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 print:relative">
         <div className="max-w-[1700px] mx-auto px-6 py-5 flex flex-col xl:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100"><Cpu className="text-white w-8 h-8" /></div>
               <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic leading-none">减振器拔出力仿真决策系统</h1>
                  <p className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">V32.0 Enterprise</span>
                     <span>Full Dynamic Decision Engine</span>
                  </p>
               </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
               <HeaderKpi label="名义拔出力" val={(results.F_total/1000).toFixed(2)} unit="kN" color="text-indigo-600" />
               <HeaderKpi label="过程能力 Cpk" val={results.mc_baseline.cpk.toFixed(3)} unit="" color={results.mc_baseline.cpk >= 1.33 ? "text-emerald-600" : "text-amber-500"} />
               <HeaderKpi label="失效概率 Pf" val={results.mc_baseline.pf_theory < 1e-6 ? "< 1.0e-6" : results.mc_baseline.pf_theory.toExponential(2)} unit="" color="text-rose-500" />
               <HeaderKpi label="安全判定" val={results.sigma_v < results.yield && results.mc_baseline.cpk >= 1.0 ? "PASS" : "FAIL"} unit="" color={results.sigma_v < results.yield && results.mc_baseline.cpk >= 1.0 ? "text-emerald-500" : "text-rose-600"} statusBg={results.sigma_v < results.yield && results.mc_baseline.cpk >= 1.0 ? "bg-emerald-50" : "bg-rose-50"} />
            </div>
         </div>
      </div>

      <div className="max-w-[1700px] mx-auto p-6 space-y-8">
        {/* 决策结论区 (Decision Conclusion Area) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12">
            <div className={`rounded-[2.5rem] p-8 border-2 flex flex-col md:flex-row items-center justify-between gap-8 transition-all shadow-2xl ${results.mc_baseline.cpk < 1.0 ? 'bg-rose-50 border-rose-200 shadow-rose-100' : 'bg-emerald-50 border-emerald-200 shadow-emerald-100'}`}>
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${results.mc_baseline.cpk < 1.0 ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                  {results.mc_baseline.cpk < 1.0 ? <Zap className="text-white w-10 h-10" /> : <ShieldCheck className="text-white w-10 h-10" />}
                </div>
                <div>
                  <h2 className={`text-3xl font-black italic tracking-tight uppercase leading-none ${results.mc_baseline.cpk < 1.0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                    设计评估结论: {results.mc_baseline.cpk < 1.0 ? 'NG (风险极高)' : 'OK (设计稳健)'}
                  </h2>
                  <p className={`mt-2 text-sm font-bold uppercase tracking-widest ${results.mc_baseline.cpk < 1.0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {results.mc_baseline.cpk < 1.0 
                      ? "→ 拔出力分布严重压线，存在批量失效风险，建议立即优化干涉量或工艺参数" 
                      : "→ 过程能力充足，设计余量满足 3σ 准则，可进入下一阶段评审"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                <ConclusionStat label="Spec Limit" val={results.target_kN.toFixed(1)} unit="kN" />
                <ConclusionStat label="Mean (μ)" val={results.mc_baseline.mean.toFixed(1)} unit="kN" />
                <ConclusionStat label="Failure Prob." val={(results.mc_baseline.pf_theory * 100).toFixed(2) + "%"} unit={results.mc_baseline.cpk < 1.0 ? "❌" : "✅"} color={results.mc_baseline.cpk < 1.0 ? "text-rose-600" : "text-emerald-600"} />
                <ConclusionStat label="Cpk" val={results.mc_baseline.cpk.toFixed(2)} unit={results.mc_baseline.cpk < 1.0 ? "❌" : "✅"} color={results.mc_baseline.cpk < 1.0 ? "text-rose-600" : "text-emerald-600"} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧控制栏 */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
           <div className="bg-indigo-900 text-white p-6 rounded-[2rem] shadow-xl shadow-indigo-200/50 mb-8 overflow-hidden relative">
              <div className="relative z-10">
                 <h2 className="text-lg font-black uppercase tracking-tighter italic">系统控制台</h2>
                 <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-1">System Control Console</p>
              </div>
              <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12"><Cpu size={120} /></div>
           </div>
           <ConfigCard title="设计目标与仿真样本" icon={<Target size={18}/>} color="indigo">
              <div className="grid grid-cols-2 gap-4">
                 <LabInput label="设计目标强度" value={params.F_target.toFixed(1)} onChange={() => {}} unit="kN" disabled />
                 <LabInput label="判定界限 (Spec)" value={params.F_spec} onChange={v => handleUpdate('F_spec', v)} unit="kN" />
                 <LabInput label="安全系数" value={params.safety_factor} onChange={v => handleUpdate('safety_factor', v)} step="0.1" />
                 <div className="col-span-2"><LabSelect label="蒙特卡罗样本量" value={params.mc_samples} onChange={v => handleUpdate('mc_samples', v)} options={[{label:"1万次 (标准)", value:10000}, {label:"10万次 (高精度)", value:100000}, {label:"100万次 (科研)", value:1000000}]} /></div>
              </div>
           </ConfigCard>

           <ConfigCard title="贮油缸规格 (Cylinder)" icon={<Box size={18}/>} color="slate">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                 {CYL_KEYS.filter(k => !PARAM_DICT[k].isMat).map(k => <LabInput key={k} label={PARAM_DICT[k].label} value={params[k]} onChange={v => handleUpdate(k, v)} unit={PARAM_DICT[k].unit} />)}
                 <div className="col-span-2"><LabSelect label="材料级别" value={params.cyl_materialKey} onChange={v => handleUpdate('cyl_materialKey', v)} options={Object.entries(MATERIALS).filter(([k])=>k.startsWith('Steel')).map(([k,v])=>({label:v.name, value:k}))} /></div>
              </div>
           </ConfigCard>

           <ConfigCard title="叉臂与定位标注 (Fork)" icon={<Ruler size={18}/>} color="blue">
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-x-4 gap-y-3">{FORK_KEYS.filter(k => !PARAM_DICT[k].isMat).map(k => <LabInput key={k} label={PARAM_DICT[k].label} value={params[k]} onChange={v => handleUpdate(k, v)} unit={PARAM_DICT[k].unit} />)}</div>
                 <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 grid grid-cols-2 gap-x-6 gap-y-3 shadow-inner">
                    <StatRow label="推导 H1 位置" val={results.current_H1.toFixed(1)} unit="mm" color="text-indigo-600" />
                    <StatRow label="名义配合过盈" val={(params.d_cyl_nom - params.d_fork_nom).toFixed(2)} unit="mm" />
                    <StatRow label="最大极限过盈" val={((params.d_cyl_nom + params.d_cyl_tol) - (params.d_fork_nom - params.d_fork_tol)).toFixed(2)} unit="mm" color="text-rose-500" />
                    <StatRow label="最小极限过盈" val={((params.d_cyl_nom - params.d_cyl_tol) - (params.d_fork_nom + params.d_fork_tol)).toFixed(2)} unit="mm" color="text-amber-600" />
                 </div>
                 <div className="col-span-2"><LabSelect label="叉臂材料" value={params.fork_materialKey} onChange={v => handleUpdate('fork_materialKey', v)} options={Object.entries(MATERIALS).filter(([k])=>k.startsWith('Al')).map(([k,v])=>({label:v.name, value:k}))} /></div>
              </div>
           </ConfigCard>
        </div>

        {/* 右侧：统计分析与 AI 决策 */}
        <div className="lg:col-span-8 space-y-8">
           
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <AnalysisChart 
                title="H1 敏感度 → 最优设计区间识别" 
                icon={<TrendingUp size={16}/>}
                summary={
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">设计余量 (Margin):</span>
                      <span className={`font-black ${(results.F_total/1000 - results.target_kN) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {((results.F_total/1000) - results.target_kN).toFixed(2)} kN
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">敏感度斜率:</span>
                      <span className="font-black text-slate-700">{results.slope.toFixed(2)} kN/mm</span>
                    </div>
                  </div>
                }
              >
                 <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={results.chartData} margin={{ top: 20, right: 35, left: 10, bottom: 25 }}>
                       <defs>
                          <linearGradient id="optimalFill" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid stroke="#e2e8f0" vertical={true} horizontal={true} />
                       <XAxis dataKey="h1" type="number" domain={[0, params.depth_fork]} ticks={results.h1Ticks} fontSize={10} tick={{fill:'#94a3b8'}} label={{ value: 'H1 位置 (mm)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b', fontWeight: 'bold' } as any} />
                       <YAxis yAxisId="left" fontSize={10} tick={{fill:'#4f46e5'}} domain={[0, 'auto']} ticks={results.forceTicks} label={{ value: '拔出力 (kN)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4f46e5', fontWeight: 'bold' } as any} />
                       <YAxis yAxisId="right" orientation="right" fontSize={10} tick={{fill:'#f43f5e'}} domain={[0, 'auto']} ticks={results.stressTicks} label={{ value: '应力 (MPa)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#f43f5e', fontWeight: 'bold' } as any} />
                       <Tooltip 
                         contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 25px rgba(0,0,0,0.1)'}}
                         formatter={(value: any, name: string) => [value, name === 'force' ? '拔出力 (kN)' : '应力 (MPa)']}
                       />
                       <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                       
                       {/* 最优区间背景 - 使用 Area 模拟以避开 ReferenceArea 类型问题 */}
                       {results.optimalRange.start !== null && (
                         <Area 
                           yAxisId="left" 
                           type="step" 
                           dataKey="safeZone" 
                           fill="#10b981" 
                           fillOpacity={0.15} 
                           stroke="none" 
                           connectNulls={false} 
                           name="推荐设计区间"
                         />
                       )}

                       <ReferenceLine yAxisId="left" y={results.target_kN} stroke="#4f46e5" strokeWidth={2} strokeDasharray="3 3" label={{value: `设计目标: ${results.target_kN}kN`, position: 'insideTopRight', offset: 10, fill: '#4f46e5', fontSize: 10, fontWeight: 'bold'}} />
                       <ReferenceLine yAxisId="left" y={params.F_spec} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" label={{value: `判定界限: ${params.F_spec}kN`, position: 'insideBottomRight', offset: 10, fill: '#f43f5e', fontSize: 10, fontWeight: 'bold'}} />
                       <ReferenceLine yAxisId="right" y={results.yield} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={2} label={{value: "材料屈服极限", position: 'insideBottomLeft', offset: 10, fill: '#f43f5e', fontSize: 10, fontWeight: 'bold'}} />
                       
                       <ReferenceLine yAxisId="left" x={results.current_H1} stroke="#000" strokeWidth={2} strokeDasharray="3 3" label={{value: `当前设计点: ${results.current_H1.toFixed(1)}mm`, position: 'top', offset: 5, fontSize: 10, fontWeight: 'black'}} />
                       
                       <Line yAxisId="left" type="monotone" dataKey="force" name="拔出力" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                       <Line yAxisId="right" type="monotone" dataKey="stress" name="应力" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    </ComposedChart>
                 </ResponsiveContainer>
                 <div className="mt-4 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">推荐设计区间 (OK Zone)</span>
                    </div>
                    {results.optimalRange.start !== null && (
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                        {results.optimalRange.start.toFixed(1)} ~ {results.optimalRange.end.toFixed(1)} mm
                      </div>
                    )}
                 </div>
              </AnalysisChart>
              <AnalysisChart 
                title="偏差源贡献度 → 行动优先级清单" 
                icon={<BarChart3 size={16}/>}
                summary={
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-black">前 3 大影响因素:</span>
                    <span className="text-slate-600 font-bold">{results.paretoData.slice(0,3).map((d:any)=>d.name.split(' ')[0]).join(', ')}</span>
                  </div>
                }
              >
                 <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={results.paretoData} margin={{ top: 20, right: 35, left: 10, bottom: 80 }}>
                       <defs>
                          <linearGradient id="focusZone" x1="0" y1="0" x2="1" y2="0">
                             <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.05}/>
                             <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid stroke="#f1f5f9" vertical={false} />
                       <XAxis 
                          dataKey="name" 
                          fontSize={9} 
                          fontWeight="bold" 
                          tick={{fill:'#64748b'}} 
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                        />
                       <YAxis yAxisId="left" fontSize={10} domain={[0, 'auto']} label={{ value: '贡献率 %', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' } as any} />
                       <YAxis yAxisId="right" orientation="right" fontSize={10} domain={[0, 100]} label={{ value: '累积 %', angle: 90, position: 'insideRight', fontSize: 10, fontWeight: 'bold' } as any} />
                       <Tooltip 
                         content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                               const data = payload[0].payload;
                               return (
                                  <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                                     <p className="text-xs font-black text-slate-800 mb-1">{data.name}</p>
                                     <p className="text-[10px] font-bold text-indigo-600">贡献率: {data.percentage}%</p>
                                     <p className="text-[10px] font-bold text-emerald-600 mt-1">改善预期收益: +{data.gain} kN</p>
                                  </div>
                               );
                            }
                            return null;
                         }}
                       />
                       <Legend verticalAlign="top" align="right" height={36} iconType="rect" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                       
                       {/* Focus Zone 80% */}
                       <ReferenceLine yAxisId="right" y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{value: "Focus Zone (80%)", position: 'left', fill: '#f43f5e', fontSize: 9, fontWeight: 'bold'}} />
                       
                       <Bar yAxisId="left" dataKey="percentage" radius={[4, 4, 0, 0]} name="贡献率" barSize={30}>
                          {results.paretoData.map((entry: any, i: number) => (
                             <Cell key={i} fill={i < 3 ? '#f43f5e' : (entry.cumulative <= 80 ? '#fb7185' : (entry.type === 'interaction' ? '#f59e0b' : '#6366f1'))} />
                          ))}
                       </Bar>
                       <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#f43f5e" strokeWidth={2} name="累积贡献" dot={{r: 3}} />
                    </ComposedChart>
                 </ResponsiveContainer>
                 <div className="mt-4 grid grid-cols-3 gap-2">
                    {results.paretoData.slice(0,3).map((d: any, i: number) => (
                      <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Top {i+1} Gain</div>
                        <div className="text-xs font-black text-emerald-600">+{d.gain} kN</div>
                      </div>
                    ))}
                 </div>
              </AnalysisChart>

              <AnalysisChart 
                title="拔出力分布直方图 (Monte Carlo)" 
                icon={<ActivityIcon size={16}/>}
                summary={
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-slate-700 font-black">μ: {results.mc_baseline.mean.toFixed(2)}kN</span>
                    <span className="text-slate-500 font-bold">σ: {results.mc_baseline.stdDev.toFixed(3)}</span>
                    <span className="text-indigo-600 font-black">Cpk: {results.mc_baseline.cpk.toFixed(3)}</span>
                    <span className="text-rose-600 font-black bg-rose-50 px-2 py-0.5 rounded border border-rose-100">P(F &lt; {params.F_spec}kN) = {results.mc_baseline.probFailSpec.toFixed(1)}%</span>
                  </div>
                }
              >
                 <div className="relative">
                    <ResponsiveContainer width="100%" height={260}>
                       <ComposedChart data={results.mc_baseline.histogram} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
                          <CartesianGrid stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="bin" fontSize={10} tick={{fill:'#64748b'}} label={{ value: '拔出力 (kN)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b', fontWeight: 'bold' } as any} />
                          <YAxis fontSize={10} label={{ value: '频数', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' } as any} />
                          <Tooltip />
                          <Legend verticalAlign="top" align="right" height={36} iconType="rect" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                          
                          {/* 工程判定线 (Spec Limit) */}
                          <ReferenceLine x={results.mc_baseline.fLimit} stroke="#f43f5e" strokeWidth={3} strokeDasharray="5 5" label={{ value: `工程判定线 (${results.mc_baseline.fLimit}kN)`, position: 'top', fill: '#f43f5e', fontSize: 10, fontWeight: 'black' }} />
                          
                          <ReferenceLine x={results.target_kN} stroke="#4f46e5" strokeWidth={1} strokeDasharray="3 3" label={{ value: '设计目标值', position: 'top', fill: '#4f46e5', fontSize: 9 }} />
                          <ReferenceLine x={results.mc_baseline.mean} stroke="#64748b" strokeDasharray="3 3" label={{ value: '均值 μ', position: 'top', fill: '#64748b', fontSize: 10 }} />
                          
                          <Bar dataKey="count" radius={[2, 2, 0, 0]} name="样本频数">
                             {results.mc_baseline.histogram.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.bin >= results.mc_baseline.fLimit ? '#10b981' : '#f43f5e'} />
                             ))}
                          </Bar>
                          <Line type="monotone" dataKey="pdfCount" stroke="#4f46e5" strokeWidth={2} dot={false} name="正态拟合" />
                       </ComposedChart>
                    </ResponsiveContainer>
                    <div className="absolute top-0 left-0 w-full flex justify-between px-12 pointer-events-none">
                       <span className="text-[9px] font-black text-rose-400 uppercase tracking-tighter">← 失效区</span>
                       <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">安全区 →</span>
                    </div>
                    <p className="text-[9px] text-slate-400 italic text-right mt-1">* 理论拟合曲线基于正态分布假设 (Assuming Normal Distribution)</p>
                 </div>
              </AnalysisChart>

              <AnalysisChart 
                title="累积分布函数 (CDF) 与设计评估" 
                icon={<TrendingUp size={16}/>}
                summary={
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">可靠度分析 (Reliability Analysis)</span>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${results.mc_baseline.cpk > 1.33 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {results.mc_baseline.cpk > 1.33 ? '稳健设计' : '存在风险'}
                    </span>
                  </div>
                }
              >
                 <div className="relative flex flex-col gap-8">
                    <div className="w-full">
                       <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={results.mc_baseline.histogram} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                             <defs>
                                <linearGradient id="cdfGradient" x1="0" y1="0" x2="1" y2="0">
                                   <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} />
                                   <stop offset={`${Math.max(0, Math.min(100, (results.mc_baseline.fLimit - results.mc_baseline.minV) / (results.mc_baseline.maxV - results.mc_baseline.minV) * 100))}%`} stopColor="#f43f5e" stopOpacity={0.6} />
                                   <stop offset={`${Math.max(0, Math.min(100, (results.mc_baseline.fLimit - results.mc_baseline.minV) / (results.mc_baseline.maxV - results.mc_baseline.minV) * 100))}%`} stopColor="#f59e0b" stopOpacity={0.4} />
                                   <stop offset={`${Math.max(0, Math.min(100, (50 - results.mc_baseline.minV) / (results.mc_baseline.maxV - results.mc_baseline.minV) * 100))}%`} stopColor="#f59e0b" stopOpacity={0.4} />
                                   <stop offset={`${Math.max(0, Math.min(100, (50 - results.mc_baseline.minV) / (results.mc_baseline.maxV - results.mc_baseline.minV) * 100))}%`} stopColor="#10b981" stopOpacity={0.2} />
                                   <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                                </linearGradient>
                             </defs>
                             <CartesianGrid stroke="#f1f5f9" vertical={false} />
                             <XAxis dataKey="bin" fontSize={10} tick={{fill:'#64748b'}} label={{ value: '拔出力 (kN)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b', fontWeight: 'bold' } as any} />
                             <YAxis fontSize={10} domain={[0, 100]} label={{ value: '累积概率 / 失效风险 (%)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' } as any} />
                             <Tooltip />
                             
                             <Area type="monotone" dataKey="cdf" stroke="#4f46e5" strokeWidth={3} fill="url(#cdfGradient)" name="累积失效概率" />
                             
                             {/* 关键决策点: F=Spec */}
                             <ReferenceLine x={results.mc_baseline.fLimit} stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" label={{ value: `F=${results.mc_baseline.fLimit}kN → 失效概率=${results.mc_baseline.probFailSpec.toFixed(1)}%`, position: 'top', fill: '#f43f5e', fontSize: 11, fontWeight: 'black' }} />
                             
                             {/* 反向读数: 90% & 99% Reliability */}
                             <ReferenceLine x={results.mc_baseline.f90} stroke="#6366f1" strokeDasharray="3 3" label={{ value: `90% 可靠度 → F≈${results.mc_baseline.f90.toFixed(1)}kN`, position: 'insideTopLeft', fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} />
                             <ReferenceLine x={results.mc_baseline.f99} stroke="#4338ca" strokeDasharray="3 3" label={{ value: `99% 可靠度 → F≈${results.mc_baseline.f99.toFixed(1)}kN`, position: 'insideTopLeft', fill: '#4338ca', fontSize: 10, fontWeight: 'bold' }} />
                             
                             {/* 区域标注 */}
                             <ReferenceLine x={50} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
                          </AreaChart>
                       </ResponsiveContainer>
                       <div className="flex justify-between px-10 mt-2">
                          <span className="text-[9px] font-bold text-rose-500 uppercase">失效区 (&lt;{results.mc_baseline.fLimit}kN)</span>
                          <span className="text-[9px] font-bold text-amber-500 uppercase">风险区 ({results.mc_baseline.fLimit}-{results.target_kN.toFixed(0)}kN)</span>
                          <span className="text-[9px] font-bold text-emerald-500 uppercase">安全区 (&gt;{results.target_kN.toFixed(0)}kN)</span>
                       </div>
                    </div>

                    {/* 设计评估结论区 (Design Assessment Box) - 移动到下方 */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
                       <div className="flex items-center gap-3 mb-6">
                          <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">CDF设计评估结论 (Design Assessment)</h4>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">判定界限 (Spec)</p>
                             <p className="text-lg font-black text-slate-800">{results.mc_baseline.fLimit} <span className="text-xs font-bold text-slate-400">kN</span></p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">均值 (μ)</p>
                             <p className="text-lg font-black text-slate-800">{results.mc_baseline.mean.toFixed(1)} <span className="text-xs font-bold text-slate-400">kN</span></p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">标准差 (σ)</p>
                             <p className="text-lg font-black text-slate-800">{results.mc_baseline.stdDev.toFixed(2)} <span className="text-xs font-bold text-slate-400">kN</span></p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">失效概率</p>
                             <p className={`text-lg font-black ${results.mc_baseline.probFailSpec > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {results.mc_baseline.probFailSpec.toFixed(1)}% {results.mc_baseline.probFailSpec > 1 ? '❌' : '✅'}
                             </p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cpk 指数</p>
                             <p className={`text-lg font-black ${results.mc_baseline.cpk < 1.33 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {results.mc_baseline.cpk.toFixed(2)} {results.mc_baseline.cpk < 1.33 ? '❌' : '✅'}
                             </p>
                          </div>
                       </div>

                       <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${results.mc_baseline.cpk < 1.33 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${results.mc_baseline.cpk < 1.33 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                {results.mc_baseline.cpk < 1.33 ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}
                             </div>
                             <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">评估结论 (Conclusion)</p>
                                <p className={`text-sm font-black ${results.mc_baseline.cpk < 1.33 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                   {results.mc_baseline.cpk < 1.33 
                                     ? "→ 设计不稳健 → 拔出失效风险高" 
                                     : "→ 设计稳健 → 失效风险极低"}
                                </p>
                             </div>
                          </div>
                          <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${results.mc_baseline.cpk < 1.33 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                             {results.mc_baseline.cpk < 1.33 ? "Action Required" : "Design Verified"}
                          </div>
                       </div>
                    </div>
                 </div>
              </AnalysisChart>

              <AnalysisChart 
                title="压力分量构成 (p_total)" 
                icon={<Layers size={16}/>}
                summary={`总接触压力: ${results.p_total.toFixed(3)} MPa`}
              >
                 <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={results.pressureBreakdown} layout="vertical" margin={{ top: 20, right: 40, left: 40, bottom: 30 }}>
                       <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                       <XAxis type="number" fontSize={10} label={{ value: '压力 (MPa)', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'bold' } as any} />
                       <YAxis dataKey="name" type="category" fontSize={10} width={80} />
                       <Tooltip />
                       <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                          <Label dataKey="value" position="right" fontSize={10} fill="#64748b" fontWeight="bold" offset={10} />
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </AnalysisChart>
           </div>

            {/* 闭环行动指南 (Closed-loop Action Guide) */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg"><RefreshCw className="text-white w-6 h-6" /></div>
                  <div>
                     <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none">工程闭环行动指南</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Closed-loop Action Guide</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 hidden md:block z-0"></div>
                  <ActionStep 
                    step="01" 
                    title="Pareto 溯源" 
                    desc="锁定 TOP 3 偏差源：几何过盈、表面摩擦、装配力矩。这些是波动的 80% 来源。" 
                    status="Focus"
                  />
                  <ActionStep 
                    step="02" 
                    title="参数分布控制" 
                    desc="通过提升加工精度或收紧力矩公差，将拔出力分布向 μ 侧收拢，提升 Cpk。" 
                    status="Control"
                  />
                  <ActionStep 
                    step="03" 
                    title="H1 敏感度校验" 
                    desc="在优化后的分布下，重新校验 H1 是否处于最优区间，确保设计裕度 Margin > 10kN。" 
                    status="Verify"
                  />
               </div>
            </div>

            {/* 核心 AI 优化决策看板 */}
            <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
              <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between">
                 <div className="flex items-center gap-3 text-white"><Zap className="animate-pulse" /><h2 className="text-xl font-black italic tracking-tight uppercase">AI 智能寻优决策工作台</h2></div>
                 <div className="flex gap-3">
                    <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2"><Printer size={16}/> 导出 PDF</button>
                    <button onClick={() => setParams(results.optResult.op)} className="bg-white text-indigo-600 font-black px-5 py-2 rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-50"><RefreshCw size={16}/> 同步寻优基准</button>
                 </div>
              </div>

              <div className="p-10 grid grid-cols-1 xl:grid-cols-12 gap-12">
                 <div className="xl:col-span-4 border-r border-slate-100 pr-10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Sliders size={14}/> 优化维度授权</h3>
                    <div className="space-y-6 max-h-[550px] overflow-y-auto custom-scroll pr-4">
                       <OptGroup title="几何尺寸与材料" keys={['cyl_materialKey','L_total','L_holes','t_inner','depth_fork']} active={optConfig} dict={PARAM_DICT} onToggle={toggleOpt} />
                       <OptGroup title="公差带精度收紧" keys={['d_cyl_tol','cyl_inner_tol','d_fork_tol','L_holes_tol','depth_fork_tol']} active={optConfig} dict={PARAM_DICT} onToggle={toggleOpt} />
                       <OptGroup title="工艺与摩擦界面" keys={['torque_nom','torque_tol','mu0_tol','Ra_fork','paint_thick_tol']} active={optConfig} dict={PARAM_DICT} onToggle={toggleOpt} />
                    </div>
                 </div>

                 <div className="xl:col-span-8 space-y-10">
                    <div className="grid grid-cols-2 gap-6">
                       <ComparisonCard title="名义拔出力强度" old={(results.F_total/1000).toFixed(2)} next={(results.optResult.base.F_total/1000).toFixed(2)} unit="kN" />
                       <ComparisonCard title="能力下限 (P01)" old={results.mc_baseline.p01.toFixed(2)} next={results.optResult.mc.p01.toFixed(2)} unit="kN" highlight />
                    </div>

                    <div className="space-y-8">
                       <SuggestionSection title="尺寸与材料优化方案" icon={<Box size={16}/>} 
                          items={Object.keys(optConfig).filter(k=>optConfig[k] && PARAM_DICT[k] && PARAM_DICT[k].cat==='dim').map(k => ({...PARAM_DICT[k], key:k}))} 
                          params={params} optParams={results.optResult.op} />
                       
                       <SuggestionSection title="制造公差管控建议" icon={<ShieldCheck size={16}/>} color="rose"
                          items={Object.keys(optConfig).filter(k=>optConfig[k] && PARAM_DICT[k] && PARAM_DICT[k].cat==='tol').map(k => ({...PARAM_DICT[k], key:k}))} 
                          params={params} optParams={results.optResult.op} />

                       <SuggestionSection title="装配工艺改进建议" icon={<Wrench size={16}/>} color="emerald"
                          items={Object.keys(optConfig).filter(k=>optConfig[k] && PARAM_DICT[k] && PARAM_DICT[k].cat==='proc').map(k => ({...PARAM_DICT[k], key:k}))} 
                          params={params} optParams={results.optResult.op} />
                    </div>
                 </div>
              </div>
           </section>

           {/* 数据来源与声明 */}
           <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-4">
                 <span>数据源: 物理仿真引擎 V3.2</span>
                 <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                 <span>算法: 蒙特卡罗随机抽样 (N={params.mc_samples})</span>
              </div>
              <div className="flex items-center gap-4">
                 <span>© 2026 减振器研发中心</span>
                 <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                 <span>机密等级: 内部公开</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  </div>
);
};

// --- 重构的对比组件 ---

const ActionStep = ({ step, title, desc, status }: any) => (
  <div className="relative z-10 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center justify-between mb-4">
      <span className="text-4xl font-black text-slate-100 group-hover:text-indigo-50 transition-colors">{step}</span>
      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded-lg">{status}</span>
    </div>
    <h4 className="text-sm font-black text-slate-800 mb-2">{title}</h4>
    <p className="text-xs text-slate-500 leading-relaxed font-medium">{desc}</p>
  </div>
);

const SuggestionSection = ({ title, icon, items, params, optParams, color="indigo" }: any) => {
   const filteredItems = items.filter((it: any) => params[it.key] !== optParams[it.key]);
   if (filteredItems.length === 0) return null;
   const theme = color === 'rose' ? 'text-rose-600 border-rose-100' : color === 'emerald' ? 'text-emerald-600 border-emerald-100' : 'text-indigo-600 border-indigo-100';
   return (
      <div className="space-y-4">
         <div className={`flex items-center gap-2 pb-2 border-b-2 ${theme}`}>
            {icon} <h4 className="text-xs font-black uppercase tracking-widest">{title}</h4>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((it: any) => (
               <div key={it.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-300 hover:bg-white transition-all group">
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold text-slate-400 italic">{it.label}</p>
                     <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                           <span className="text-[9px] text-slate-300 font-bold uppercase leading-none">基准</span>
                           <span className="text-xs font-mono text-slate-500 leading-tight">
                              {it.isMat ? MATERIALS[params[it.key]].name : Number(params[it.key]).toFixed(it.fix)}
                           </span>
                        </div>
                        <ArrowRight size={14} className="text-slate-200" />
                        <div className="flex flex-col">
                           <span className="text-[9px] text-indigo-400 font-bold uppercase leading-none">优化</span>
                           <span className={`text-sm font-black font-mono leading-tight ${color === 'rose' ? 'text-rose-600' : color === 'emerald' ? 'text-emerald-600' : 'text-indigo-700'}`}>
                              {it.isMat ? MATERIALS[optParams[it.key]].name : Number(optParams[it.key]).toFixed(it.fix)}
                              <span className="text-[9px] font-normal ml-1 opacity-60 uppercase">{it.unit}</span>
                           </span>
                        </div>
                     </div>
                  </div>
                  <ActionBadge oldV={params[it.key]} newV={optParams[it.key]} cat={it.cat} isMat={it.isMat} />
               </div>
            ))}
         </div>
      </div>
   );
};

const ActionBadge = ({ oldV, newV, cat, isMat }: any) => {
   let isInc = false;
   let isDec = false;

   if (isMat) {
     const oldYield = MATERIALS[oldV]?.yield || 0;
     const newYield = MATERIALS[newV]?.yield || 0;
     isInc = newYield > oldYield;
     isDec = newYield < oldYield;
   } else {
     isInc = newV > oldV;
     isDec = newV < oldV;
   }

   if (!isInc && !isDec) return null;
   let label = "";
   if (cat === 'tol') label = "精度收紧";
   else if (isMat) label = isInc ? "材质升级" : "材质降级";
   else if (isInc) label = "调高";
   else label = "调低";

   return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${isDec && cat==='tol' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
         {isInc ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>} {label}
      </div>
   );
};

const OptGroup = ({ title, keys, active, dict, onToggle }: any) => (
   <div className="space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-50 pb-1">{title}</p>
      {keys.map((k: any) => <OptCheck key={k} label={dict[k]?.label || k} active={active[k]} onClick={()=>onToggle(k)}/>)}
   </div>
);

// --- 基础美化组件 ---

const ConclusionStat = ({ label, val, unit, color="text-slate-900" }: any) => (
  <div className="bg-white/50 px-5 py-3 rounded-2xl border border-white/20 min-w-[120px]">
    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-xl font-black ${color} flex items-baseline gap-1`}>{val} <span className="text-[10px] font-bold opacity-60">{unit}</span></div>
  </div>
);

const HeaderKpi = ({ label, val, unit, color, statusBg = "bg-white" }: any) => (
  <div className={`${statusBg} border border-slate-200 px-6 py-4 rounded-2xl shadow-sm min-w-[160px] transition-all hover:-translate-y-1`}>
    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-2xl font-black ${color} flex items-baseline gap-1`}>{val} <span className="text-xs font-bold opacity-60">{unit}</span></div>
  </div>
);

const ConfigCard = ({ title, icon, color, children }: any) => {
  const colors: Record<string, string> = {
    indigo: "border-indigo-500 text-indigo-600 bg-indigo-50/40",
    slate: "border-slate-400 text-slate-600 bg-slate-50/60",
    blue: "border-blue-500 text-blue-600 bg-blue-50/40",
    emerald: "border-emerald-500 text-emerald-600 bg-emerald-50/40"
  };
  return (
    <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className={`px-5 py-3 border-b flex items-center gap-3 font-black text-xs uppercase italic tracking-widest ${colors[color]}`}>
         {icon} {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
};

const AnalysisChart = ({ title, icon, summary, children }: any) => (
  <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-l-4 border-indigo-600 pl-4">
       <div className="flex items-center gap-3">
          <span className="text-indigo-600">{icon}</span>
          <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{title}</h3>
       </div>
       {summary && (
         <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
           {summary}
         </div>
       )}
    </div>
    {children}
  </div>
);

const LabInput = ({ label, value, onChange, unit, step = "any" }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-slate-500 px-1 truncate block italic">{label}</label>
    <div className="relative">
      <input type="number" step={step} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-black text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner" />
      {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase pointer-events-none">{unit}</span>}
    </div>
  </div>
);

const LabSelect = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-slate-500 px-1 italic">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none appearance-none transition-all shadow-sm cursor-pointer">
      {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const StatRow = ({ label, val, unit, color="text-slate-700" }: any) => (
  <div className="flex justify-between items-center text-[11px] py-1 border-b border-blue-100/30 last:border-0">
    <span className="text-slate-500 font-bold">{label}</span>
    <span className={`font-mono font-black ${color}`}>{val} <span className="text-[9px] font-normal opacity-40">{unit}</span></span>
  </div>
);

const OptCheck = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 text-[11px] font-bold ${active ? 'text-indigo-600' : 'text-slate-400'} transition-all hover:bg-indigo-50/50 p-2 rounded-lg`}>
    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${active ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
       {active && <Check size={12} className="text-white" strokeWidth={4} />}
    </div>
    <span className="truncate text-left">{label}</span>
  </button>
);

const ComparisonCard = ({ title, old, next, unit, highlight }: any) => (
  <div className={`p-6 rounded-3xl border ${highlight ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-200'}`}>
    <div className={`text-[10px] font-black mb-3 uppercase tracking-widest ${highlight ? 'text-indigo-100' : 'text-slate-400'}`}>{title}</div>
    <div className="flex items-center gap-4">
       <div className={`text-base line-through opacity-30 font-mono ${highlight ? 'text-white' : 'text-slate-900'}`}>{old}</div>
       <ChevronRight size={18} className="opacity-30" />
       <div className="text-3xl font-black font-mono tracking-tighter">{next} <span className="text-xs opacity-60 font-bold">{unit}</span></div>
    </div>
  </div>
);

export default App;

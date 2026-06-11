import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function StatCard({ title, value, icon: Icon, trend, trendValue, colorClass, sub, isText }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper ${colorClass}`}><Icon size={17} /></div>
      </div>
      <div className={`kpi-value ${isText ? "kpi-value-text" : ""}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <div className={`kpi-trend trend-${trend}`}>
        {trend === "up"      && <TrendingUp   size={13} />}
        {trend === "down"    && <TrendingDown  size={13} />}
        {trend === "neutral" && <Minus         size={13} />}
        <span>{trendValue}</span>
      </div>
    </div>
  );
}

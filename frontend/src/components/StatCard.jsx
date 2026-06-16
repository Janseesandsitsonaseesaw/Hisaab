import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function StatCard({ title, value, icon: Icon, trend, trendValue, colorClass, sub, isText, loading }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        <div className={`kpi-icon-wrapper ${colorClass}`}>
          <Icon size={16} strokeWidth={2.25} />
        </div>
      </div>
      {loading ? (
        <>
          <div className="shimmer" style={{ height: "24px", width: "75%", marginTop: "6px", borderRadius: "4px" }} />
          <div className="shimmer" style={{ height: "14px", width: "45%", marginTop: "6px", borderRadius: "3px" }} />
          <div className="shimmer" style={{ height: "12px", width: "55%", marginTop: "8px", borderRadius: "3px" }} />
        </>
      ) : (
        <>
          <div className={`kpi-value ${isText ? "kpi-value-text" : ""}`} style={{ marginTop: "2px" }}>
            {value}
          </div>
          {sub && <div className="kpi-sub">{sub}</div>}
          <div className={`kpi-trend trend-${trend}`} style={{ marginTop: "4px" }}>
            {trend === "up"      && <TrendingUp   size={12} strokeWidth={2.5} />}
            {trend === "down"    && <TrendingDown  size={12} strokeWidth={2.5} />}
            {trend === "neutral" && <Minus         size={12} strokeWidth={2.5} />}
            <span>{trendValue}</span>
          </div>
        </>
      )}
    </div>
  );
}

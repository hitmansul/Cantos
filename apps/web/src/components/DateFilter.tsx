"use client";

import { useState } from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DateFilterOption = "all" | "today" | "tomorrow" | "this_week" | "next_week" | "custom";

interface DateFilterProps {
  value: DateFilterOption;
  onChange: (option: DateFilterOption) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
}

// Helper to get date strings in Brasília timezone
const getBrasiliaDate = (date: Date): string => {
  return new Intl.DateTimeFormat('sv-SE', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const getToday = () => getBrasiliaDate(new Date());

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getBrasiliaDate(d);
};

const getThisWeekEnd = () => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  return getBrasiliaDate(d);
};

const getNextWeekEnd = () => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilSunday = 7 - dayOfWeek + 7;
  d.setDate(d.getDate() + daysUntilSunday);
  return getBrasiliaDate(d);
};

const getNextWeekStart = () => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
  d.setDate(d.getDate() + daysUntilNextMonday);
  return getBrasiliaDate(d);
};

export function getDateRange(option: DateFilterOption, customStart?: string, customEnd?: string): { start: string; end: string } | null {
  switch (option) {
    case "all":
      return null;
    case "today":
      return { start: getToday(), end: getToday() };
    case "tomorrow":
      return { start: getTomorrow(), end: getTomorrow() };
    case "this_week":
      return { start: getToday(), end: getThisWeekEnd() };
    case "next_week":
      return { start: getNextWeekStart(), end: getNextWeekEnd() };
    case "custom":
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      return null;
    default:
      return null;
  }
}

export function DateFilter({ value, onChange, customStartDate, customEndDate, onCustomDateChange }: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [tempStart, setTempStart] = useState(customStartDate || getToday());
  const [tempEnd, setTempEnd] = useState(customEndDate || getTomorrow());

  const handleCustomApply = () => {
    if (onCustomDateChange) {
      onCustomDateChange(tempStart, tempEnd);
    }
    onChange("custom");
    setShowCustom(false);
  };

  const options: { key: DateFilterOption; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "today", label: "Hoje" },
    { key: "tomorrow", label: "Amanhã" },
    { key: "this_week", label: "Esta semana" },
    { key: "next_week", label: "Próx. semana" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Filtrar por data:</span>
        
        {options.map((opt) => (
          <Button
            key={opt.key}
            variant={value === opt.key ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onChange(opt.key);
              setShowCustom(false);
            }}
            className="text-xs h-7"
          >
            {opt.label}
          </Button>
        ))}
        
        <Button
          variant={value === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs h-7"
        >
          Período
        </Button>
        
        {value !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("all");
              setShowCustom(false);
            }}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {showCustom && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">De:</label>
            <input
              type="date"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              className="px-2 py-1 text-sm rounded border bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Até:</label>
            <input
              type="date"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              className="px-2 py-1 text-sm rounded border bg-background"
            />
          </div>
          <Button size="sm" onClick={handleCustomApply} className="text-xs h-7">
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function DateFilterCompact({ value, onChange }: Pick<DateFilterProps, "value" | "onChange">) {
  const options: { key: DateFilterOption; label: string; icon?: React.ReactNode }[] = [
    { key: "all", label: "Todos" },
    { key: "today", label: "Hoje" },
    { key: "tomorrow", label: "Amanhã" },
    { key: "this_week", label: "Semana" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`
            px-2 py-1 text-xs rounded-md transition-colors
            ${value === opt.key 
              ? "bg-emerald-500/20 text-emerald-400 font-medium" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

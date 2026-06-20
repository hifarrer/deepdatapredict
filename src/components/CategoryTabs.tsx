"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CategoryTabs({
  categories,
  value,
  onValueChange,
}: {
  categories: string[];
  value: string;
  onValueChange: (v: string) => void;
}) {
  const all = ["All", ...categories];
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList className="flex w-full flex-wrap gap-1 overflow-x-auto">
        {all.map((c) => (
          <TabsTrigger key={c} value={c}>
            {c}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

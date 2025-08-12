"use client";

import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useMemberStats } from "@/hooks/use-members";
import { type TimeRange } from "./dashboardContent";

type Props = {
  timeRange: TimeRange;
  customDate?: DateRange;
};

type Member = {
  id: string;
  displayName: string;
  replyCount: number;
};

export const PeopleTable = ({ timeRange, customDate }: Props) => {
  const statsInput =
    timeRange === "custom"
      ? { period: "24h" as const, customStartDate: customDate?.from, customEndDate: customDate?.to }
      : { period: timeRange };

  const { stats: members, isLoading } = useMemberStats(
    statsInput.period,
    statsInput.customStartDate,
    statsInput.customEndDate
  );

  if (isLoading) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex-1 min-h-0">
          <Table>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-0 py-3">
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell className="px-0 py-3 text-right">
                    <Skeleton className="h-4 w-[60px] ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      {members?.length ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableBody>
              {members.map((member: Member) => (
                <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="px-0 py-3 font-medium">{member.displayName}</TableCell>
                  <TableCell className="px-0 py-3 text-right font-mono text-sm">
                    {member.replyCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">No data available.</div>
      )}
    </div>
  );
};

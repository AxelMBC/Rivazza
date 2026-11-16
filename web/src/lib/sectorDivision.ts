import type { TrackSection } from "@rivazza/protocol";

import { lowerIndex, SECTOR_COUNT } from "./lapAnalysis";

export type SectorDivision = {
  bounds: readonly number[];
  names: readonly string[] | null;
};

export const equalDivision = (count: number): SectorDivision => ({
  bounds: Array.from({ length: count + 1 }, (_, i) => i / count),
  names: null,
});

export const divisionFromSections = (
  sections: readonly TrackSection[],
): SectorDivision => ({
  bounds: [
    0,
    ...sections
      .slice(1)
      .map((section, i) => (sections[i].out + section.in) / 2),
    1,
  ],
  names: sections.map((section) => section.name),
});

export const sessionDivision = (
  sections: readonly TrackSection[] | null | undefined,
): SectorDivision =>
  sections ? divisionFromSections(sections) : equalDivision(SECTOR_COUNT);

export const sectorCount = (division: SectorDivision): number =>
  division.bounds.length - 1;

export const sectorIndexAt = (division: SectorDivision, pos: number): number =>
  lowerIndex(division.bounds.length, (i) => division.bounds[i], pos);

export const sectorLabel = (division: SectorDivision, i: number): string =>
  division.names?.[i] ?? `S${i + 1}`;

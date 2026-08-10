import prisma from '@/lib/db';

/** Recalculates the review summary after a user changes an allocation category. */
export async function refreshWorkSessionTotals(workSessionId: string) {
  const allocations = await prisma.allocation.findMany({ where: { workSessionId } });
  const unallocatedMinutes = allocations
    .filter((allocation) => allocation.allocationType === 'unallocated')
    .reduce((total, allocation) => total + allocation.durationMinutes, 0);
  const allocatedMinutes = allocations
    .filter((allocation) => allocation.allocationType !== 'unallocated')
    .reduce((total, allocation) => total + allocation.durationMinutes, 0);

  return prisma.workSession.update({
    where: { id: workSessionId },
    data: { allocatedMinutes, unallocatedMinutes },
  });
}

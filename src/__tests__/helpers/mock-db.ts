export interface MemoryStore {
  users: any[];
  integrations: any[];
  workItems: any[];
  normalizedEvents: any[];
  userLearnings: any[];
  userCorrections: any[];
  workSessions: any[];
  allocations: any[];
  allocationEvidences: any[];
  timesheets: any[];
  timesheetEntries: any[];
}

export function createMemoryStore(): MemoryStore {
  return {
    users: [],
    integrations: [],
    workItems: [],
    normalizedEvents: [],
    userLearnings: [],
    userCorrections: [],
    workSessions: [],
    allocations: [],
    allocationEvidences: [],
    timesheets: [],
    timesheetEntries: [],
  };
}

let idCounter = 1;
function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}

export function createMockPrisma(store: MemoryStore = createMemoryStore()) {
  const mockPrisma: any = {
    _store: store,
    reset() {
      store.users = [];
      store.integrations = [];
      store.workItems = [];
      store.normalizedEvents = [];
      store.userLearnings = [];
      store.userCorrections = [];
      store.workSessions = [];
      store.allocations = [];
      store.allocationEvidences = [];
      store.timesheets = [];
      store.timesheetEntries = [];
    },

    user: {
      async findUnique({ where }: any) {
        if (where.id) return store.users.find((u) => u.id === where.id) || null;
        if (where.email) return store.users.find((u) => u.email === where.email) || null;
        return null;
      },
      async findMany({ where }: any = {}) {
        return [...store.users];
      },
      async create({ data }: any) {
        const item = { id: data.id || genId('user'), ...data, createdAt: new Date(), updatedAt: new Date() };
        store.users.push(item);
        return item;
      },
      async upsert({ where, create, update }: any) {
        let existing = await mockPrisma.user.findUnique({ where });
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        return mockPrisma.user.create({ data: create });
      },
    },

    integration: {
      async findMany({ where }: any = {}) {
        let res = store.integrations || [];
        if (where?.userId) res = res.filter((i) => i.userId === where.userId);
        return res;
      },
      async findUnique({ where }: any) {
        if (where?.userId_provider) {
          const { userId, provider } = where.userId_provider;
          return (store.integrations || []).find((i) => i.userId === userId && i.provider === provider) || null;
        }
        return null;
      },
      async upsert({ where, create, update }: any) {
        let existing = await mockPrisma.integration.findUnique({ where });
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const item = { id: genId('int'), ...create, createdAt: new Date(), updatedAt: new Date() };
        if (!store.integrations) store.integrations = [];
        store.integrations.push(item);
        return item;
      },
      async deleteMany({ where }: any = {}) {
        if (!store.integrations) store.integrations = [];
        let count = 0;
        store.integrations = store.integrations.filter((i) => {
          if (where?.userId && i.userId !== where.userId) return true;
          if (where?.provider && i.provider !== where.provider) return true;
          count++;
          return false;
        });
        return { count };
      },
      async updateMany({ where, data }: any = {}) {
        if (!store.integrations) store.integrations = [];
        let count = 0;
        for (const i of store.integrations) {
          if ((!where.userId || i.userId === where.userId) && (!where.provider || i.provider === where.provider)) {
            Object.assign(i, data);
            count++;
          }
        }
        return { count };
      },
    },

    workItem: {
      async findMany({ where }: any = {}) {
        let res = [...store.workItems];
        if (where?.userId) res = res.filter((w) => w.userId === where.userId);
        return res;
      },
      async findUnique({ where }: any) {
        if (where.id) return store.workItems.find((w) => w.id === where.id) || null;
        return null;
      },
      async create({ data }: any) {
        const item = { id: data.id || genId('wi'), ...data, createdAt: new Date(), updatedAt: new Date() };
        store.workItems.push(item);
        return item;
      },
      async createMany({ data }: any) {
        const items = data.map((d: any) => ({ id: d.id || genId('wi'), ...d, createdAt: new Date(), updatedAt: new Date() }));
        store.workItems.push(...items);
        return { count: items.length };
      },
      async upsert({ where, create, update }: any) {
        let existing = store.workItems.find(
          (w) =>
            (where.id && w.id === where.id) ||
            (where.userId_provider_externalId &&
              w.userId === where.userId_provider_externalId.userId &&
              w.provider === where.userId_provider_externalId.provider &&
              w.externalId === where.userId_provider_externalId.externalId)
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        return mockPrisma.workItem.create({ data: create });
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.workItems = store.workItems.filter((w) => {
          if (where?.userId && w.userId !== where.userId) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    normalizedEvent: {
      async findMany({ where, orderBy }: any = {}) {
        let res = [...store.normalizedEvents];
        if (where?.userId) res = res.filter((e) => e.userId === where.userId);
        if (where?.occurredAt?.gte && where?.occurredAt?.lte) {
          const gte = new Date(where.occurredAt.gte).getTime();
          const lte = new Date(where.occurredAt.lte).getTime();
          res = res.filter((e) => {
            const t = new Date(e.occurredAt).getTime();
            return t >= gte && t <= lte;
          });
        }
        if (orderBy?.occurredAt === 'asc') {
          res.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
        }
        return res;
      },
      async findFirst({ where }: any = {}) {
        return (
          store.normalizedEvents.find(
            (e) =>
              (!where.userId || e.userId === where.userId) &&
              (!where.provider || e.provider === where.provider) &&
              (!where.eventType || e.eventType === where.eventType) &&
              (!where.title || e.title === where.title) &&
              (!where.occurredAt || new Date(e.occurredAt).getTime() === new Date(where.occurredAt).getTime())
          ) || null
        );
      },
      async create({ data }: any) {
        const item = { id: data.id || genId('ne'), ...data, createdAt: new Date() };
        store.normalizedEvents.push(item);
        return item;
      },
      async createMany({ data }: any) {
        const items = data.map((d: any) => ({ id: d.id || genId('ne'), ...d, createdAt: new Date() }));
        store.normalizedEvents.push(...items);
        return { count: items.length };
      },
      async update({ where, data }: any) {
        const existing = store.normalizedEvents.find((e) => e.id === where.id);
        if (existing) {
          Object.assign(existing, data);
        }
        return existing;
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.normalizedEvents = store.normalizedEvents.filter((e) => {
          if (where?.userId && e.userId !== where.userId) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    userLearning: {
      async findMany({ where, orderBy }: any = {}) {
        let res = [...store.userLearnings];
        if (where?.userId) res = res.filter((l) => l.userId === where.userId);
        if (orderBy?.occurrences === 'desc') {
          res.sort((a, b) => b.occurrences - a.occurrences);
        }
        return res;
      },
      async findUnique({ where }: any) {
        if (where.id) return store.userLearnings.find((l) => l.id === where.id) || null;
        if (where.userId_learningType_pattern) {
          const { userId, learningType, pattern } = where.userId_learningType_pattern;
          return (
            store.userLearnings.find(
              (l) => l.userId === userId && l.learningType === learningType && l.pattern === pattern
            ) || null
          );
        }
        return null;
      },
      async create({ data }: any) {
        const item = {
          id: data.id || genId('ul'),
          confidence: 1.0,
          occurrences: 1,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.userLearnings.push(item);
        return item;
      },
      async update({ where, data }: any) {
        const existing = store.userLearnings.find((l) => l.id === where.id);
        if (existing) {
          Object.assign(existing, data, { updatedAt: new Date() });
        }
        return existing;
      },
      async upsert({ where, create, update }: any) {
        let existing = await mockPrisma.userLearning.findUnique({ where });
        if (existing) {
          return mockPrisma.userLearning.update({ where: { id: existing.id }, data: update });
        }
        return mockPrisma.userLearning.create({ data: create });
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.userLearnings = store.userLearnings.filter((l) => {
          if (where?.userId && l.userId !== where.userId) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    userCorrection: {
      async create({ data }: any) {
        const item = { id: data.id || genId('uc'), ...data, createdAt: new Date() };
        store.userCorrections.push(item);
        return item;
      },
      async upsert({ where, create, update }: any) {
        const existing = store.userCorrections.find((c) => c.allocationId === where.allocationId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        return mockPrisma.userCorrection.create({ data: create });
      },
    },

    workSession: {
      async findMany({ where }: any = {}) {
        let res = [...store.workSessions];
        if (where?.userId) res = res.filter((s) => s.userId === where.userId);
        return res;
      },
      async findUnique({ where, include }: any) {
        let session = null;
        if (where.id) {
          session = store.workSessions.find((s) => s.id === where.id);
        } else if (where.userId_date) {
          const uId = where.userId_date.userId;
          const targetDateStr = new Date(where.userId_date.date).toISOString().split('T')[0];
          session = store.workSessions.find(
            (s) => s.userId === uId && new Date(s.date).toISOString().split('T')[0] === targetDateStr
          );
        }

        if (!session) return null;

        const res = { ...session };
        if (include?.allocations) {
          let allocs = store.allocations
            .filter((a) => a.workSessionId === session.id)
            .map((a) => {
              const allocCopy = { ...a };
              if (include.allocations.include?.workItem) {
                allocCopy.workItem = store.workItems.find((w) => w.id === a.workItemId) || null;
              }
              if (include.allocations.include?.evidence) {
                let evs = store.allocationEvidences.filter((e) => e.allocationId === a.id);
                if (include.allocations.include.evidence.include?.normalizedEvent) {
                  evs = evs.map((e) => ({
                    ...e,
                    normalizedEvent: store.normalizedEvents.find((ne) => ne.id === e.normalizedEventId) || null,
                  }));
                }
                allocCopy.evidence = evs;
              }
              return allocCopy;
            });

          if (include.allocations.orderBy?.startTime === 'asc') {
            allocs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
          }
          res.allocations = allocs;
        }
        return res;
      },
      async upsert({ where, create, update }: any) {
        let existing = await mockPrisma.workSession.findUnique({ where });
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const item = {
          id: create.id || genId('ws'),
          ...create,
          status: create.status || 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.workSessions.push(item);
        return item;
      },
      async update({ where, data }: any) {
        const existing = store.workSessions.find((s) => s.id === where.id);
        if (existing) {
          Object.assign(existing, data, { updatedAt: new Date() });
        }
        return existing;
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.workSessions = store.workSessions.filter((s) => {
          if (where?.userId && s.userId !== where.userId) return true;
          if (where?.id?.in && !where.id.in.includes(s.id)) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    allocation: {
      async findMany({ where }: any = {}) {
        let res = [...store.allocations];
        if (where?.workSessionId) res = res.filter((a) => a.workSessionId === where.workSessionId);
        if (where?.workSessionId?.in) res = res.filter((a) => where.workSessionId.in.includes(a.workSessionId));
        return res;
      },
      async findUnique({ where, include }: any) {
        const alloc = store.allocations.find((a) => a.id === where.id);
        if (!alloc) return null;
        const res = { ...alloc };
        if (include?.workSession) {
          res.workSession = store.workSessions.find((s) => s.id === alloc.workSessionId) || null;
        }
        if (include?.workItem) {
          res.workItem = store.workItems.find((w) => w.id === alloc.workItemId) || null;
        }
        if (include?.evidence) {
          res.evidence = store.allocationEvidences.filter((e) => e.allocationId === alloc.id);
        }
        return res;
      },
      async create({ data }: any) {
        const item = {
          id: data.id || genId('alloc'),
          status: 'suggested',
          isUserModified: false,
          sortOrder: 0,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.allocations.push(item);
        return item;
      },
      async createMany({ data }: any) {
        const items = data.map((d: any) => ({
          id: d.id || genId('alloc'),
          status: d.status || 'suggested',
          isUserModified: d.isUserModified || false,
          sortOrder: d.sortOrder || 0,
          ...d,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        store.allocations.push(...items);
        return { count: items.length };
      },
      async update({ where, data, include }: any) {
        const existing = store.allocations.find((a) => a.id === where.id);
        if (existing) {
          Object.assign(existing, data, { updatedAt: new Date() });
        }
        return mockPrisma.allocation.findUnique({ where, include });
      },
      async delete({ where }: any) {
        const idx = store.allocations.findIndex((a) => a.id === where.id);
        if (idx !== -1) {
          const removed = store.allocations.splice(idx, 1)[0];
          return removed;
        }
        return null;
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.allocations = store.allocations.filter((a) => {
          if (where.workSessionId && a.workSessionId !== where.workSessionId) return true;
          if (where.workSessionId?.in && !where.workSessionId.in.includes(a.workSessionId)) return true;
          if (where.isUserModified !== undefined && a.isUserModified !== where.isUserModified) return true;
          if (where.id?.in && !where.id.in.includes(a.id)) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    allocationEvidence: {
      async createMany({ data }: any) {
        const items = data.map((d: any) => ({ id: d.id || genId('ae'), ...d }));
        store.allocationEvidences.push(...items);
        return { count: items.length };
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.allocationEvidences = store.allocationEvidences.filter((e) => {
          if (where?.allocationId && e.allocationId !== where.allocationId) return true;
          if (where?.allocationId?.in && !where.allocationId.in.includes(e.allocationId)) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    timesheet: {
      async findUnique({ where, include }: any) {
        const ts = store.timesheets.find((t) => t.id === where.id || t.workSessionId === where.workSessionId);
        if (!ts) return null;
        const res = { ...ts };
        if (include?.entries) {
          res.entries = store.timesheetEntries.filter((e) => e.timesheetId === ts.id);
        }
        return res;
      },
      async upsert({ where, create, update, include }: any) {
        let existing = store.timesheets.find((t) => t.workSessionId === where.workSessionId);
        if (existing) {
          Object.assign(existing, { totalMinutes: update.totalMinutes, status: update.status, updatedAt: new Date() });
          if (update.entries?.deleteMany) {
            store.timesheetEntries = store.timesheetEntries.filter((e) => e.timesheetId !== existing.id);
          }
          if (update.entries?.create) {
            const newEntries = update.entries.create.map((c: any) => ({
              id: genId('tse'),
              timesheetId: existing.id,
              ...c,
            }));
            store.timesheetEntries.push(...newEntries);
          }
          return mockPrisma.timesheet.findUnique({ where: { id: existing.id }, include });
        }

        const newTsId = genId('ts');
        const ts = {
          id: newTsId,
          workSessionId: create.workSessionId,
          userId: create.userId,
          date: create.date,
          totalMinutes: create.totalMinutes,
          status: create.status || 'approved',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.timesheets.push(ts);
        if (create.entries?.create) {
          const newEntries = create.entries.create.map((c: any) => ({
            id: genId('tse'),
            timesheetId: newTsId,
            ...c,
          }));
          store.timesheetEntries.push(...newEntries);
        }
        return mockPrisma.timesheet.findUnique({ where: { id: newTsId }, include });
      },
    },

    timesheetEntry: {
      async createMany({ data }: any) {
        const items = data.map((d: any) => ({ id: genId('tse'), ...d }));
        store.timesheetEntries.push(...items);
        return { count: items.length };
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        store.timesheetEntries = store.timesheetEntries.filter((e) => {
          if (where.timesheetId && e.timesheetId !== where.timesheetId) return true;
          count++;
          return false;
        });
        return { count };
      },
    },

    async $transaction(arg: any) {
      if (typeof arg === 'function') {
        return arg(mockPrisma);
      } else if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      throw new Error('Unsupported $transaction argument');
    },
  };

  return mockPrisma;
}

export const defaultMockPrisma = createMockPrisma();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

const ensureDataDir = () => {
  const dataDir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const loadTasks = () => {
  try {
    ensureDataDir();
    if (fs.existsSync(TASKS_FILE)) {
      const buffer = fs.readFileSync(TASKS_FILE, 'utf-8');
      return JSON.parse(buffer);
    }
    return [];
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
};

const saveTasks = (tasks) => {
  try {
    ensureDataDir();
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
    return true;
  } catch (error) {
    if (error.code === 'EROFS') {
      console.warn('⚠️ Read-only file system detected. Skipping local task backup.');
    } else {
      console.error('Error saving tasks:', error);
    }
    return false;
  }
};

const defaultAudit = (updatedBy) => {
  const now = new Date().toISOString();
  return {
    created_at: now,
    updated_at: now,
    completed_at: null,
    updated_by: updatedBy || null
  };
};

const normalizeScheduleLog = (events = []) => {
  return events.map((event) => ({
    id: event.id || crypto.randomUUID(),
    type: event.type || 'update',
    note: event.note || null,
    from: event.from || null,
    to: event.to || null,
    updated_by: event.updated_by || null,
    at: event.at || new Date().toISOString()
  }));
};

const normalizeChecklist = (checklist = []) => {
  return checklist.map((item, index) => {
    if (typeof item === 'string') {
      return { id: crypto.randomUUID(), label: item, checked: false, order: index };
    }
    return {
      id: item.id || crypto.randomUUID(),
      label: item.label || item.text || `Item ${index + 1}`,
      checked: Boolean(item.checked),
      order: item.order ?? index
    };
  });
};

const normalizeAcceptanceCriteria = (criteria = []) => {
  return criteria.map((item, index) => {
    if (typeof item === 'string') {
      return { id: crypto.randomUUID(), label: item, satisfied: false, order: index };
    }
    return {
      id: item.id || crypto.randomUUID(),
      label: item.label || item.text || `Criterio ${index + 1}`,
      satisfied: Boolean(item.satisfied),
      order: item.order ?? index
    };
  });
};

const recomputeTasks = (tasks) => {
  const taskMap = new Map();
  const originalMap = new Map();
  const clonedTasks = tasks.map((task) => {
    const cloned = { ...task, checklist: task.checklist || [], acceptance_criteria: task.acceptance_criteria || [], children: [] };
    taskMap.set(cloned.task_id, cloned);
    originalMap.set(cloned.task_id, task);
    return cloned;
  });

  clonedTasks.forEach((task) => {
    if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
      const parent = taskMap.get(task.parent_task_id);
      parent.children.push(task);
    }
  });

  const flattened = [];
  const seen = new Set();

  const compute = (node, parentStatus) => {
    let status = node.status || 'todo';

    if (parentStatus === 'blocked' && status !== 'done') {
      status = 'blocked';
    }

    const computedChildren = node.children.map((child) => compute(child, status));
    const anyChildBlocked = computedChildren.some((child) => child.status === 'blocked');
    const allChildrenDone = computedChildren.length > 0 && computedChildren.every((child) => child.status === 'done');

    const checklistDone = (node.checklist || []).filter((item) => item.checked).length;
    const checklistProgress = node.checklist.length ? Math.round((checklistDone / node.checklist.length) * 100) : 0;

    if (computedChildren.length) {
      if (anyChildBlocked && status !== 'done') {
        status = 'blocked';
      }

      if (allChildrenDone && node.qa?.approved) {
        status = 'done';
      } else if (status === 'done' && (!allChildrenDone || !node.qa?.approved)) {
        status = 'in_progress';
      }
    } else if (status === 'done' && !node.qa?.approved) {
      status = 'in_progress';
    }

    const avgChildProgress = computedChildren.length
      ? Math.round(computedChildren.reduce((sum, child) => sum + child.progress, 0) / computedChildren.length)
      : 0;

    let progress = status === 'done'
      ? 100
      : computedChildren.length
        ? Math.max(avgChildProgress, checklistProgress)
        : Math.max(checklistProgress, status === 'in_progress' ? 25 : 0);

    const originalAudit = originalMap.get(node.task_id)?.audit || {};
    const audit = {
      created_at: originalAudit.created_at || node.audit?.created_at || new Date().toISOString(),
      updated_at: node.audit?.updated_at || originalAudit.updated_at || originalAudit.created_at || new Date().toISOString(),
      completed_at: originalAudit.completed_at || node.audit?.completed_at || null,
      updated_by: node.audit?.updated_by || originalAudit.updated_by || null
    };

    if (status === 'done' && !audit.completed_at) {
      audit.completed_at = new Date().toISOString();
    }

    const computedTask = {
      ...node,
      status,
      progress,
      qa: node.qa || { approved: false, evidence: [], notes: null, qa_user: null, qa_at: null },
      audit,
      children: undefined
    };

    seen.add(node.task_id);
    flattened.push(computedTask);

    return { ...computedTask, children: computedChildren };
  };

  clonedTasks
    .filter((task) => !task.parent_task_id)
    .forEach((root) => compute(root, null));

  clonedTasks
    .filter((task) => !seen.has(task.task_id))
    .forEach((orphan) => compute(orphan, null));

  return flattened;
};

const buildTree = (tasks, taskId, depth = 0, maxDepth = 3) => {
  const current = tasks.find((task) => task.task_id === taskId);
  if (!current) return null;

  if (depth >= maxDepth) {
    return { ...current, children: [] };
  }

  const children = tasks
    .filter((task) => task.parent_task_id === taskId)
    .map((child) => buildTree(tasks, child.task_id, depth + 1, maxDepth))
    .filter(Boolean);

  return { ...current, children };
};

export const createTaskStore = () => {
  let tasks = recomputeTasks(loadTasks());

  const persist = (updatedTasks) => {
    tasks = recomputeTasks(updatedTasks);
    saveTasks(tasks);
    return tasks;
  };

  return {
    createTask(payload, updatedBy) {
      const newTask = {
        task_id: payload.task_id || crypto.randomUUID(),
        parent_task_id: payload.parent_task_id || null,
        title: payload.title?.trim() || 'Tarea sin título',
        description: payload.description || '',
        owner: payload.owner || null,
        estimate: payload.estimate || null,
        status: payload.status || 'todo',
        acceptance_criteria: normalizeAcceptanceCriteria(payload.acceptance_criteria),
        checklist: normalizeChecklist(payload.checklist),
        dependencies: payload.dependencies || [],
        labels: payload.labels || [],
        type: payload.type || null,
        scheduled_date: payload.scheduled_date || null,
        scheduled_time: payload.scheduled_time || null,
        scheduled_with_time: payload.scheduled_with_time ?? false,
        next_schedule_time: payload.next_schedule_time || null,
        timezone: payload.timezone || null,
        schedule_log: normalizeScheduleLog(payload.schedule_log),
        progress: 0,
        qa: payload.qa || { approved: false, evidence: [], notes: null, qa_user: null, qa_at: null },
        audit: payload.audit || defaultAudit(updatedBy || payload.owner)
      };

      const updated = [...tasks, newTask];
      const persisted = persist(updated);
      return persisted.find((task) => task.task_id === newTask.task_id);
    },

    updateTask(taskId, updates, updatedBy) {
      const index = tasks.findIndex((task) => task.task_id === taskId);
      if (index === -1) {
        throw new Error('Task not found');
      }

      const updatedTask = { ...tasks[index] };

      if (updates.status === 'done') {
        const children = tasks.filter((task) => task.parent_task_id === taskId);
        const qaApproved = updates.qa?.approved ?? updatedTask.qa?.approved;
        const allChildrenDone = children.every((child) => child.status === 'done' && (child.qa?.approved || false));

        if (children.length && (!allChildrenDone || !qaApproved)) {
          throw new Error('No se puede marcar como done sin que todas las subtareas estén en done y con QA aprobado');
        }

        if (!qaApproved) {
          throw new Error('No se puede marcar como done sin QA aprobado');
        }
      }

      updatedTask.title = updates.title?.trim() || updatedTask.title;
      updatedTask.description = updates.description ?? updatedTask.description;
      updatedTask.owner = updates.owner ?? updatedTask.owner;
      updatedTask.estimate = updates.estimate ?? updatedTask.estimate;
      updatedTask.status = updates.status || updatedTask.status;
      updatedTask.dependencies = Array.isArray(updates.dependencies) ? updates.dependencies : updatedTask.dependencies;
      updatedTask.labels = Array.isArray(updates.labels) ? updates.labels : updatedTask.labels;
      updatedTask.type = updates.type ?? updatedTask.type;

      const scheduleFields = [
        'scheduled_date',
        'scheduled_time',
        'scheduled_with_time',
        'next_schedule_time',
        'timezone'
      ];

      const scheduleBefore = scheduleFields.reduce((acc, field) => ({ ...acc, [field]: updatedTask[field] ?? null }), {});
      let scheduleChanged = false;

      scheduleFields.forEach((field) => {
        if (updates[field] !== undefined) {
          updatedTask[field] = updates[field];
          scheduleChanged = scheduleChanged || updates[field] !== scheduleBefore[field];
        }
      });

      if (Array.isArray(updates.schedule_log)) {
        updatedTask.schedule_log = normalizeScheduleLog(updates.schedule_log);
      }

      if (scheduleChanged) {
        updatedTask.schedule_log = normalizeScheduleLog([
          ...(updatedTask.schedule_log || []),
          {
            type: 'schedule_update',
            from: scheduleBefore,
            to: scheduleFields.reduce((acc, field) => ({ ...acc, [field]: updatedTask[field] ?? null }), {}),
            updated_by: updatedBy || updates.updated_by || updatedTask.audit?.updated_by || null,
            at: new Date().toISOString()
          }
        ]);
      }

      if (updates.acceptance_criteria) {
        updatedTask.acceptance_criteria = normalizeAcceptanceCriteria(updates.acceptance_criteria);
      }

      if (updates.checklist) {
        updatedTask.checklist = normalizeChecklist(updates.checklist);
      }

      updatedTask.qa = {
        approved: updates.qa?.approved ?? updatedTask.qa?.approved ?? false,
        evidence: updates.qa?.evidence ?? updatedTask.qa?.evidence ?? [],
        notes: updates.qa?.notes ?? updatedTask.qa?.notes ?? null,
        qa_user: updates.qa?.qa_user ?? updatedTask.qa?.qa_user ?? null,
        qa_at: updates.qa?.qa_at ?? updatedTask.qa?.qa_at ?? null
      };

      updatedTask.audit = {
        ...(updatedTask.audit || defaultAudit(updatedBy)),
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || updates.updated_by || updatedTask.audit?.updated_by
      };

      const updatedList = [...tasks];
      updatedList[index] = updatedTask;
      tasks = persist(updatedList);
      return tasks.find((task) => task.task_id === taskId);
    },

    setAcceptance(taskId, acceptancePayload, updatedBy) {
      const index = tasks.findIndex((task) => task.task_id === taskId);
      if (index === -1) {
        throw new Error('Task not found');
      }

      const updatedTask = { ...tasks[index] };
      const criteria = acceptancePayload.acceptance_criteria || updatedTask.acceptance_criteria;

      updatedTask.acceptance_criteria = normalizeAcceptanceCriteria(criteria).map((criterion) => {
        const incoming = (acceptancePayload.acceptance_criteria || []).find((item) => item.id === criterion.id || item.label === criterion.label);
        if (incoming && typeof incoming.satisfied !== 'undefined') {
          return { ...criterion, satisfied: Boolean(incoming.satisfied) };
        }
        return criterion;
      });

      const allCriteriaSatisfied = updatedTask.acceptance_criteria.every((item) => item.satisfied);

      updatedTask.qa = {
        approved: acceptancePayload.approved ?? updatedTask.qa?.approved ?? false,
        evidence: acceptancePayload.evidence ?? updatedTask.qa?.evidence ?? [],
        notes: acceptancePayload.notes ?? updatedTask.qa?.notes ?? null,
        qa_user: acceptancePayload.qa_user || acceptancePayload.updated_by || updatedTask.qa?.qa_user || updatedBy || null,
        qa_at: new Date().toISOString()
      };

      if (acceptancePayload.approved === undefined && allCriteriaSatisfied) {
        updatedTask.qa.approved = true;
      }

      updatedTask.audit = {
        ...(updatedTask.audit || defaultAudit(updatedBy)),
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || acceptancePayload.updated_by || updatedTask.audit?.updated_by
      };

      const updatedList = [...tasks];
      updatedList[index] = updatedTask;
      tasks = persist(updatedList);
      return tasks.find((task) => task.task_id === taskId);
    },

    setDependencies(taskId, dependencies = [], updatedBy) {
      const index = tasks.findIndex((task) => task.task_id === taskId);
      if (index === -1) {
        throw new Error('Task not found');
      }

      const updatedTask = {
        ...tasks[index],
        dependencies: dependencies,
        audit: {
          ...(tasks[index].audit || defaultAudit(updatedBy)),
          updated_at: new Date().toISOString(),
          updated_by: updatedBy || tasks[index].audit?.updated_by
        }
      };

      const updatedList = [...tasks];
      updatedList[index] = updatedTask;
      tasks = persist(updatedList);
      return tasks.find((task) => task.task_id === taskId);
    },

    listTasks(parentTaskId = null, maxDepth = 3) {
      const latest = recomputeTasks(tasks);
      tasks = latest;

      if (parentTaskId) {
        const subset = latest.filter((task) => task.parent_task_id === parentTaskId);
        const nested = subset.map((task) => buildTree(latest, task.task_id, 0, maxDepth)).filter(Boolean);
        return nested;
      }

      const roots = latest.filter((task) => !task.parent_task_id);
      return roots.map((task) => buildTree(latest, task.task_id, 0, maxDepth)).filter(Boolean);
    },

    getTask(taskId, maxDepth = 3) {
      const latest = recomputeTasks(tasks);
      tasks = latest;
      return buildTree(latest, taskId, 0, maxDepth);
    }
  };
};

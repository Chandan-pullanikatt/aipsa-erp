// A subject may be taught by several teachers, some scoped to one section.
// Include this on any subject query that needs to name a teacher.
const SUBJECT_TEACHERS_INCLUDE = {
  teacher: { select: { id: true, firstName: true, lastName: true } },
  teachers: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
  },
};

// Teachers of `subject` as one student/section sees them. A section-specific
// assignment overrides the class-wide ones for that section; several rows for
// the same scope means co-teaching, so all of them are returned. Falls back to
// Subject.teacherId for subjects that predate the join table.
function teachersForSection(subject, sectionId) {
  const rows = subject.teachers || [];
  const scoped = sectionId ? rows.filter(r => r.sectionId === sectionId) : [];
  const picked = scoped.length > 0 ? scoped : rows.filter(r => !r.sectionId);
  if (picked.length > 0) return picked.map(r => r.teacher).filter(Boolean);
  return subject.teacher ? [subject.teacher] : [];
}

module.exports = { SUBJECT_TEACHERS_INCLUDE, teachersForSection };

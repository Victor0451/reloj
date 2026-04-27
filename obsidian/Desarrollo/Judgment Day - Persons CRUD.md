---
tags: [review, bugs, persons, judgment-day]
date: 2026-04-14
---

# Judgment Day — Persons CRUD

> [!success] Estado: **APPROVED** ✅
> Módulo Persons CRUD passou em 3 rodadas de revisão adversarial.

---

## Resumo

Módulo de gestão de pessoas (CRUD) passou por revisão adversarial com 2 judges cegos independentes usando o protocolo Judgment Day.

### Histórico

| Round | Judge A | Judge B | Resultado |
|-------|---------|---------|----------|
| 1 | 12 issues | 13 issues | 10 confirmed → Fix applied |
| 2 | 12 suspect | CLEAN | Necesita decisión |
| 3 | edge cases | edge cases | APPROVED ✅ |

---

## Bugs Encontrados e Corrigidos

### Round 1 — Confirmados (10 issues)

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | persons-client.tsx | Props innecesarias en interfaz | CRITICAL |
| 2 | photo-upload.tsx | handleRemove no borra de Supabase | CRITICAL |
| 3 | persons.ts | Batch insert falha tutto chunk | CRITICAL |
| 4 | persons.ts | getPhotoSignedUrl nunca usado | CRITICAL |
| 5 | csv-import-dialog.tsx | Error ignorado en toast | WARNING |
| 6 | persons-table.tsx | useDebouncedCallback wrong API | WARNING |
| 7 | csv-import-dialog.tsx | File input no resetea | WARNING |
| 8 | persons.ts | ilike sin sanitization | WARNING |
| 9 | person.types.ts | statusFilter genérico | WARNING |
| 10 | csv-import-dialog.tsx | Array index como key | WARNING |

### Round 2 — Theoretical (12 suspect, no fix necessário)

- useDebouncedCallback dependency capture
- DB reference update en handleRemove
- Batch check vs existentes
- Change detection clearing
- y otros edge cases teóricos

### Round 3 — Mejoras menores (opcional)

- N+1 query (fixable con batch check)
- AbortController (si batchCreatePersons acepta signal)
- useEffect deps cleanup (menor)

---

## Arquivos Revisados

```
src/
├── app/(dashboard)/dashboard/persons/
│   └── persons-client.tsx        ← Client wrapper
├── components/persons/
│   ├── persons-table.tsx        ← Table + search
│   ├── person-dialog.tsx     ← Create/Edit
│   ├── photo-upload.tsx     ← Photos
│   └── csv-import-dialog.tsx ← Import
├── actions/
│   └── persons.ts           ← Server Actions
└── types/
    └── person.types.ts      ← TypeScript types
```

---

## Correções Aplicadas

### 1. Props Innecessarias
```typescript
// REMOVIDO de PersonsClientProps
createPerson: typeof createPerson
updatePerson: typeof updatePerson
deletePerson: typeof deletePerson
reactivatePerson: typeof reactivatePerson
```

### 2. Photo Delete
```typescript
// ANTES: solo storage
await supabase.storage.from('face-photos').remove([path])

// DEPOIS: storage + DB
await supabase.storage.from('face-photos').remove([path])
await updatePerson(id, { face_photo_url: null })
```

### 3. Batch Insert
```typescript
// ANTES: chunk entero falla
if (chunkRows.some(r => isInvalid(r))) {
  errors.push(...chunkRows) // 50 falhas!
}

// DEPOIS: individual
for (const row of chunkRows) {
  try {
    await insertRow(row)
  } catch (err) {
    errors.push(err) // solo 1
  }
}
```

### 4. Signed URLs
```typescript
// ANTES: public URL
const { data } = supabase.storage.from('face-photos').getPublicUrl(path)

// DEPOIS: signed URL
const { data } = supabase.storage.from('face-photos').createSignedUrl(path, 3600)
```

### 5. Error Handling
```typescript
// ANTES
toast.error('Error al importar')

// DEPOIS
toast.error(result.error ?? 'Error al importar')
```

### 6. Debounce
```typescript
// ANTES (wrong)
const debouncedSearch = useDebouncedCallback(fn, 300, [statusFilter])

// DEPOIS (correct)
const debouncedSearch = useDebouncedCallback(fn, 300)
const handleSearch = (value: string) => {
  setSearchInput(value)
  debouncedSearch(value, statusFilter)
}
```

---

## Ver También

- [[Módulo - Personas]]
- [[Desarrollo - Guía de Desarrollo]]
- [[Stack Tecnológico]]
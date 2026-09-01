# Shared identity and product-mode handoff

Phase 2 keeps identity and product authorization separate.

## Live status

The Phase 2 database foundation is live. Anonymous student sessions are bound
to the exact class used at sign-in, `class_product_access` is live, and the
educator set-access and student effective-access RPCs are live. Educator and
student authorization smoke tests passed, as did the human Phase 1 regression
for student sign-in, exact-class restoration, and refresh persistence.

The Account frontend changes that expose this foundation remain local and
unpublished. No Story Builder, Morphology, Primo Volo, or Free Sample product
repository has been integrated with student mode yet.

The database history is intentionally represented by three review artifacts:

- `phase2_class_product_access_foundation.sql` records the original foundation.
- `fix_set_class_product_access_conflict_target.sql` records the live RPC fix.
- `optimize_class_product_access_rls_and_fk_index.sql` records the live index
  and RLS optimization.

## Account modes

Educator mode uses a permanent Supabase educator user plus a current product
entitlement. It may render the full educator-owned product, including guided
instruction, educator supports, management, notes, assessment resources, and
progress monitoring.

Student mode uses an anonymous Supabase Auth user linked to a shared
`public.students.id`, a specific active class recorded on the session link, an
active membership in that class, a `class_product_access` assignment, and the
class owner's current entitlement. Products must verify this mode before they
render and must expose only their student-facing subset.

An Account-page assignment means only that the student may eventually enter
the product's student mode. It never grants educator capabilities. Phase 2 does
not link into products because the product repositories do not yet enforce this
authorization boundary.

## Future product integration

Each product should inspect the current Supabase user before rendering:

- permanent educator + active entitlement → educator mode
- anonymous user + valid class-bound student context + effective product access
  → student mode
- anything else → fail closed

The product must verify effective access through a database-controlled RPC. It
must not trust a product key, student ID, class ID, or mode supplied by the
browser.

## Future progress integration

`public.students.id` is the cross-product student identity. Product learning
records remain product-specific and map to that shared ID; mature product
learning and synchronization tables should not be replaced by a shared
aggregate table.

Suggested product-specific records include:

- Morphology: shared student ID, flight/morpheme, activity, vocabulary level,
  performance, support level, date, and mode (`educator_guided`,
  `student_independent`, or `assessment`).
- Story Builder: shared student ID, story/session, narrative target, First
  Tell/Retell cycle, status, appropriate educator notes, date, and mode.
- Primo Volo: shared student ID, topic, activity, Starting Check result,
  practice/completion state, date, and mode.

Future educator progress reads must verify that the educator owns the relevant
student/class. Students must never be able to read another student's records.
Cross-product summaries should be computed only after those product-specific
authorization and mapping paths are established.

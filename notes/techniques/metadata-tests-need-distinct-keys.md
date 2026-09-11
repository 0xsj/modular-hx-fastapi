# A merge test needs a key that the update does not mention

Testing only a collision cannot distinguish merging a map from replacing it.

## Origin

The same selected mutation changed metadata enrichment to replacement in Go,
Rust and TypeScript. In every build, the new E10 scenario was the only case that
failed for that mutation. The earlier ownership scenarios passed.

This was evidence of a test gap in the earlier fixtures, not a production merge
bug: the actual implementations already merged correctly.

## Why the first fixture was insufficient

Start with `{email: required}` and update with `{email: malformed}`. Both a correct
merge and an incorrect whole-map replacement produce `{email: malformed}`.
Even checking that the original map stayed unchanged does not tell those
implementations apart: a replacement can allocate a fresh map too.

Choose a fixture that forces the difference:

| Stage | email | name | age |
| --- | --- | --- | --- |
| Original | required | required | absent |
| Update | malformed | not supplied | positive |
| Expected result | malformed | required | positive |

Now the expected result proves three separate promises: collision replacement,
preservation of an unrelated key and insertion of a new key.

## The same wrong behavior in different syntax

| Language | Correct merge operation | Wrong replacement operation |
| --- | --- | --- |
| Go | Copy incoming entries into the cloned destination | Assign a clone of only the incoming map |
| Rust | Extend the owned destination with incoming entries | Assign the incoming map as the destination |
| TypeScript | Spread existing fields, then incoming fields | Spread only incoming fields |

The operations use different ownership mechanisms, but the missing name key is
observable through every public projection. No test needs to inspect a private
map, allocation or cloning helper to catch it.

## Keep related promises separate

A useful metadata suite also checks that changing supplied maps or public
snapshots cannot change the originating failure. Private details should retain
unrelated keys too. Finally, source replacement must preserve the enriched
classification and metadata while replacing only the diagnostic source.

Using more keys everywhere is not the goal. Give each fixture a value that makes
its particular failure mode visible. A source-identity assertion needs a distinct
source object; a public-disclosure assertion needs a recognizable private value;
a merge assertion needs an untouched key.

## Gotchas

Do not generate the expected map with the same merge helper the implementation
uses. Otherwise both sides can share the same defect. Write the small expected
record explicitly or assert the meaningful keys independently.

## Used in and related

Used in metadata enrichment, partial configuration updates, patch operations and
other APIs that promise to retain unspecified values. Continue with
[specification tests and targeted mutations](specification-tests-and-targeted-mutations.md)
for how to measure whether a fixture catches the intended fault.

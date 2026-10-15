# Battle-type categories in depth

Different game modes pay differently, so the site groups matches into **battle types** and shows each group's numbers separately. The rules that decide the group are yours to edit.

## How a match gets its category
1. The site reads the **mode name** from the match headline (the part in square brackets).
2. It walks your **rules from top to bottom**. A rule is a **keyword** and a **label**.
3. The **first rule whose keyword appears anywhere in the mode name** wins. The comparison ignores upper/lower case, and the keyword only has to be *contained* in the mode name (it doesn't need to match the whole thing).
4. If no rule matches, the match is a **Random Battles** match.

So a rule with the keyword *Assault* would catch *Tank Assault*, *Air Assault*, or anything else containing the word.

## The default rules
A fresh install has one rule: **Tank Assault → Tank Assault**. Everything else is *Random Battles*.

## Adding a rule
1. Open **Battle-type categories** on the Basic view.
2. Type a **keyword** you can see in a mode name (for example *Arcade*).
3. Type the **label** you want to see in tables (for example *Arcade Battles*).
4. Click **Add rule**.
5. Click **Analyze** again to re-sort your matches.

Rules are saved in your browser as you type. Every rule row can be edited in place, and **Remove** deletes it.

### Tips for good keywords
- Use a distinctive word from the mode name, not a whole sentence.
- Check the exact spelling in your logs: the **Per-match detail** table shows each match's mode.
- Keep the label short; it appears in the split table, the goal calculator's drop-down and the Advanced view's filter.
- Two rules may share one label — handy to merge two modes into one group.

## Order matters
Rules are checked in the order shown, and the first hit wins. If one keyword is contained in another (say *Assault* and *Tank Assault*), the earlier rule takes the match. There is no drag-to-reorder: remove and re-add a rule to change its position.

## What changes when you edit a rule
- **Basic view:** the next **Analyze** uses the new rules.
- **Advanced view:** matches are re-classified when the page is opened or refreshed, using your current rules; the *Battle type* filter shows the labels in use.
- **Saved archive:** your matches are not changed on disk; the category is decided when they are shown.
- **Exports:** an HTML report or minimal export records the categories as they were when you exported.

## Limits
- Up to 100 rules are kept.
- Keywords and labels are cut at 100 characters; text is always displayed safely as plain text.
- Rules live in your browser only and are not part of a raw export — if you move to another device, re-create them (they are short).

## Examples
| Goal | Keyword | Label |
|---|---|---|
| Separate Arcade from Realistic | Arcade | Arcade Battles |
| Group two event modes together | Event A (and again with Event B) | Events |
| Keep Tank Assault apart (default) | Tank Assault | Tank Assault |

## Common questions
**My new category is empty.** The keyword must appear in the mode name; check spelling and re-Analyze.

**Can I rename a category later?** Yes, edit the label in the rule row and Analyze again.

**Why is everything "Random Battles"?** No rule matched. That is the fallback group by design.

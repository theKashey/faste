# Working on faste

## Finding your way in the code

Ask before you grep: `yarn variance ask uses --name <name>` lists who imports a
name, `ask symbol --name <name>` prints what it is and where it is declared, and
`ask search --query <words>` finds a name by what it does. The
`variance-authority` skill has the rest.

## Testing an edit

`VARIANCE_AUTHORITY_SINCE= yarn jest` runs only the tests your edit reached, and
says `selected N of M` first. When it selects none, Jest prints `No tests found`
and exits 1: that is not a failure.

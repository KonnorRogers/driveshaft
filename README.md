# DriveShaft

A wholely incomplete answer to Turbo Drive.

DriveShaft is much slimmer. Its only focused on SPA-like navigation for your MPA.

- No streams
- No frames
- Just body / head replacements.

This repo is extremely incomplete. Don't use this...

## Missing Features

- [x] - There are no view transitions currently.
- [x] - There is no way to preserve elements.
- [ ] - Head merging in default strategy is ~~very...naive~~ still needs to be tested thoroughly.
- [ ] - Has really only tested form based navigation + anchor navigation, and not much else.
- [ ] - Need to check scroll / focus state
- [ ] - Need to check redirects
- [ ] - Requires hooks (either js based or event based) to allow customizing behavior.

## Installation

```bash
npm install driveshaft
```

## Usage

```js
import { DriveShaft } from "driveshaft"
new DriveShaft().start()
```


### Using Morphlex

```bash
npm install morphlex
```

```js
import { morph } from "morphlex"

import { DriveShaft } from "driveshaft"

const driveShaft = new DriveShaft()
driveShaft.replaceStrategy = (newDOM) => {
  // upgrade custom elements
  const newBody = document.adoptNode(newDOM.body)
  morph(document.head, newDOM.head)
  morph(document.body, newBody)
  driveShaft.syncAttributes(document.documentElement, newDOM.documentElement)
}
driveShaft.start()
```

# DriveShaft

A wholely incomplete answer to Turbo Drive.

DriveShaft is much slimmer. Its only focused on SPA-like navigation for your MPA.

- No streams
- No frames
- Just body / head replacements.

This repo is extremely incomplete. Don't use this...

## Missing Features

- [ ] - There are no view transitions currently.
- [ ] - There is no way to preserve elements.
- [ ] - Head merging in default strategy is very...naive.
- [ ] - Has really only tested form based navigation and not much else.

## Installation

```bash
npm install driveshaft @virtualstate/navigation
```

## Usage

```js
// Optional polyfill (trust me, just use it. `navigate` isn't supported in any browser except Chrome)
import "@virtualstate/navigation/polyfill"

import { DriveShaft } from "driveshaft"
new DriveShaft().start()
```


### Using Morphlex

```bash
npm install morphlex
```

```js
import "@virtualstate/navigation/polyfill"
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

# Contributing

Review the following guidelines for submitting questions, issues, or changes to this repository.

## Questions

If you have issues using the SDK or have a question about the App Configuration service, you can ask a question on [Stack Overflow](https://stackoverflow.com/questions/tagged/ibm-appconfiguration). Be sure to include the `ibm-appconfiguration` tag.

## Generate reference documentation

```sh
$ npm install
$ chmod +x ./generate_typedoc.sh
$ ./generate_typedoc.sh
```

This will generate the documentation for all the public methods and classes of the SDK in a new folder named `typedoc`.

## Coding Style
This SDK project follows a coding style based on the [Airbnb conventions](https://github.com/airbnb/javascript).
This repository uses `eslint` for linting the TypeScript files.
The rules are defined in `.eslintrc` file.
It is recommended that you do not change these files, since they complies with the defined rules.

You can run the linter with the following commands. Replacing “check” with “fix” will cause the linter to automatically fix any linting errors that it can.
- `npm run lint:check`

## Issues

If you encounter an issue with the JavaScript SDK, you are welcome to submit a [bug report](https://github.com/IBM/appconfiguration-js-client-sdk/issues).
Before that, please search for similar issues. It's possible somebody has encountered this issue already.

## Pull Requests

If you want to contribute to the repository, here's a quick guide:

1. Fork the repository
2. Install dependencies: `npm install`
    * Respect the original code [style guide][styleguide].
    * Only use spaces for indentation.
    * Create minimal diffs - disable on save actions like reformat source code or organize imports. If you feel the source code should be reformatted create a separate PR for this change.
    * Check for unnecessary whitespace with `git diff --check` before committing.
    * You can run the style check by running the `npm run lint:check`
3. Commit your changes
    * We recommend using the [Commitizen CLI](https://github.com/commitizen/cz-cli) with the `cz-conventional-changelog` adapter.
4. Push to your fork and submit a pull request to the `main` branch

## Additional Resources

* [General GitHub documentation](https://help.github.com/)
* [GitHub pull request documentation](https://help.github.com/send-pull-requests/)

[dw]: https://developer.ibm.com/answers/questions/ask/?topics=appconfiguration
[stackoverflow]: http://stackoverflow.com/questions/ask?tags=ibm-appconfiguration
[styleguide]: https://github.com/airbnb/javascript

# Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
   have the right to submit it under the open source license
   indicated in the file; or

(b) The contribution is based upon previous work that, to the best
   of my knowledge, is covered under an appropriate open source
   license and I have the right under that license to submit that
   work with modifications, whether created in whole or in part
   by me, under the same open source license (unless I am
   permitted to submit under a different license), as indicated
   in the file; or

(c) The contribution was provided directly to me by some other
   person who certified (a), (b) or (c) and I have not modified
   it.

(d) I understand and agree that this project and the contribution
   are public and that a record of the contribution (including all
   personal information I submit with it, including my sign-off) is
   maintained indefinitely and may be redistributed consistent with
   this project or the open source license(s) involved.

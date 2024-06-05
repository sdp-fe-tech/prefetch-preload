
# Vue prefetch

[![npm version](https://badge.fury.io/js/vue-prefetch.svg)](https://badge.fury.io/js/vue-prefetch)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Build and Test](#build-and-test)
- [Peer Dependencies](#peer-dependencies)
- [Contributing](#contributing)
- [License](#license)

## Introduction

`Vue prefetch` is a powerful and flexible npm package that provides utility methods for Vue.js, as well as custom Webpack loaders and plugins. This package is designed to be highly modular, supporting multiple module formats including ES, CommonJS, and UMD.

## Features

- **Vue.js utility methods**: A collection of useful methods to streamline your Vue.js development.
- **Custom Webpack loaders and plugins**: Enhance your Webpack configuration with custom loaders and plugins.
- **TypeScript support**: Written in TypeScript for type safety and better developer experience.
- **Modular output**: Supports ES, CommonJS, and UMD module formats.
- **Comprehensive testing**: Includes a robust testing setup using Jest.

## Installation

To install the package, you can use npm or yarn:

```bash
npm install vue-prefetch
```

```bash
yarn add vue-prefetch
```

## Usage

### Importing the Package

You can import the package in your project as follows:

```javascript
// ES Module
import { hello } from 'vue-prefetch';

// CommonJS
const { hello } = require('vue-prefetch');
```

### Example

```typescript
import { hello } from 'vue-prefetch';

console.log(hello()); // Output: Hello World
```

## Build and Test

To build the package, use the following command:

```bash
npm run build
```

To run the tests, use the following command:

```bash
npm test
```

## Peer Dependencies

Ensure that the following peer dependencies are installed in your project:

- `babel-core@6.26.3`
- `webpack@^5`
- `babel-loader@>=7.1.5`
- `vue-loader@>=14.2.4`
- `node@>=14`
- `npm@>=6.0.0`

You can install them with:

```bash
npm install babel-core@6.26.3 webpack@^5 babel-loader@>=7.1.5 vue-loader@>=14.2.4
```

## Contributing

We welcome contributions to this project. Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch with a descriptive name.
3. Make your changes.
4. Commit your changes with clear and concise commit messages.
5. Push your changes to your forked repository.
6. Create a pull request to the main repository.

Please ensure all tests pass and add appropriate tests for any new features or bug fixes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```

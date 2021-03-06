# IBM App Configuration JavaScript Client SDK
IBM Cloud App Configuration JavaScript Client SDK is used to perform feature flag and property evaluation in web applications based on the configuration on IBM Cloud App Configuration service.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Initialize SDK](#initialize-sdk)
- [License](#license)

## Overview

IBM Cloud App Configuration is a centralized feature management and configuration service
on [IBM Cloud](https://www.cloud.ibm.com) for use with web and mobile applications, microservices, and distributed
environments.

Instrument your web applications with App Configuration JavaScript Client SDK, and use the App Configuration dashboard, CLI or API to
define feature flags or properties, organized into collections and targeted to segments. Toggle feature flag states in
the cloud to activate or deactivate features in your application or environment, when required. You can also manage the
properties for distributed applications centrally.

## Browser Compatibility
The SDK is supported on all major browsers. The Browser should have `fetch()` API support.

## Installation

Install the SDK. Use the following code to install as a module from package manager.

```sh
npm install ibm-appconfiguration-js-client-sdk@latest
```
You can import the SDK into the script tag either by referencing it from a hosted site on your backend or from a CDN as follows:
  
Example:
```html
    <script type="text/javascript" src="https://unpkg.com/ibm-appconfiguration-js-client-sdk@latest/dist/appconfiguration.js"></script>
```

## Initialize SDK

Initialize the sdk to connect with your App Configuration service instance.

```JS
const region = AppConfiguration.REGION_US_SOUTH;
const guid = '<guid>';
const apikey = '<apikey>';

const collectionId = 'airlines-webapp';
const environmentId = 'dev';

const appConfigClient = AppConfiguration.getInstance();
appConfigClient.init(region, guid, apikey);
await appConfigClient.setContext(collectionId, environmentId);
```

:red_circle: **Important** :red_circle:

The **`init()`** and **`setContext()`** are the initialisation methods and should be invoked **only once** using appConfigClient. The appConfigClient, once initialised, can be obtained across modules using **`AppConfiguration.getInstance()`**.

- region : Region name where the App Configuration service instance is created. Use
    - `AppConfiguration.REGION_US_SOUTH` for Dallas
    - `AppConfiguration.REGION_EU_GB` for London
    - `AppConfiguration.REGION_AU_SYD` for Sydney
    - `AppConfiguration.REGION_US_EAST` for Washington DC
- guid : Instance Id of the App Configuration service. Obtain it from the service credentials section of the App
  Configuration dashboard.
- apikey : ApiKey of the App Configuration service. Obtain it from the service credentials section of the App
  Configuration dashboard.
- collectionId: Id of the collection created in App Configuration service instance under the **Collections** section.
- environmentId: Id of the environment created in App Configuration service instance under the **Environments** section.

:red_circle: **Important** :red_circle:

Ensure to create the service credentials of the role **`Client SDK`** for using with the JavaScript SDK. API key of the **`Client SDK`** role has minimal access permissions that are suitable to use in browser based applications.


**Important**

There might be timeout errors in the browser console related to communication to the App Configuration backend, while using with the SDK. This is expected as part of the limitation of the streaming API and can be ignored.  

## Get single feature

```javascript
const feature = appConfigClient.getFeature('online-check-in'); // feature can be null incase of an invalid feature id

if (feature != null) {
  console.log(`Feature Name ${feature.getFeatureName()} `);
  console.log(`Feature Id ${feature.getFeatureId()} `);
  console.log(`Feature Type ${feature.getFeatureDataType()} `);
}
```

## Get all features

```javascript
const features = appConfigClient.getFeatures();
const feature = features['online-check-in'];

if (feature != null) {
  console.log(`Feature Name ${feature.getFeatureName()} `);
  console.log(`Feature Id ${feature.getFeatureId()} `);
  console.log(`Feature Type ${feature.getFeatureDataType()} `);
  console.log(`Is feature enabled? ${feature.isEnabled()} `);
}
```

## Evaluate a feature

Use the `feature.getCurrentValue(entityId, entityAttributes)` method to evaluate the value of the feature flag.
This method returns one of the Enabled/Disabled/Overridden value based on the evaluation. The data type of returned value matches that of feature flag.

```javascript
const entityId = 'john_doe';
const entityAttributes = {
  city: 'Bangalore',
  country: 'India',
};

const featureValue = feature.getCurrentValue(entityId, entityAttributes);
```
- entityId: Id of the Entity. This will be a string identifier related to the Entity against which the feature is evaluated. For example, an entity might be an instance of an app that runs on a mobile device, or a user accessing the web application. For any entity to interact with App Configuration, it must provide a unique entity ID.
- entityAttributes: A JSON object consisting of the attribute name and their values that defines the specified entity. This is an optional parameter if the feature flag is not configured with any targeting definition. If the targeting is configured, then entityAttributes should be provided for the rule evaluation. An attribute is a parameter that is used to define a segment. The SDK uses the attribute values to determine if the specified entity satisfies the targeting rules, and returns the appropriate feature flag value.

## Get single property

```javascript
const property = appConfigClient.getProperty('check-in-charges'); // property can be null incase of an invalid property id

if (property != null) {
  console.log(`Property Name ${property.getPropertyName()} `);
  console.log(`Property Id ${property.getPropertyId()} `);
  console.log(`Property Type ${property.getPropertyDataType()} `);
}
```

## Get all properties

```javascript
const properties = appConfigClient.getProperties();
const property = properties['check-in-charges'];

if (property != null) {
  console.log(`Property Name ${property.getPropertyName()} `);
  console.log(`Property Id ${property.getPropertyId()} `);
  console.log(`Property Type ${property.getPropertyDataType()} `);
}
```

## Evaluate a property

Use the `property.getCurrentValue(entityId, entityAttributes)` method to evaluate the value of the property.
This method returns the default property value or its overridden value based on the evaluation. The data type of returned value matches that of property.

```javascript
const entityId = 'john_doe';
const entityAttributes = {
  city: 'Bangalore',
  country: 'India',
};

const propertyValue = property.getCurrentValue(entityId, entityAttributes);
```
- entityId: Id of the Entity. This will be a string identifier related to the Entity against which the property is evaluated. For example, an entity might be an instance of an app that runs on a mobile device, or a user accessing the web application. For any entity to interact with App Configuration, it must provide a unique entity ID.
- entityAttributes: A JSON object consisting of the attribute name and their values that defines the specified entity. This is an optional parameter if the property is not configured with any targeting definition. If the targeting is configured, then entityAttributes should be provided for the rule evaluation. An attribute is a parameter that is used to define a segment. The SDK uses the attribute values to determine if the specified entity satisfies the targeting rules, and returns the appropriate property value.

## Supported Data types

App Configuration service allows to configure the feature flag and properties in the following data types : Boolean,
Numeric, String. The String data type can be of the format of a text string , JSON or YAML. The SDK processes each
format accordingly as shown in the below table.

<details><summary>View Table</summary>

| **Feature or Property value**                                                                          | **DataType** | **DataFormat** | **Type of data returned <br> by `getCurrentValue()`** | **Example output**                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------ | -------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `true`                                                                                                 | BOOLEAN      | not applicable | `boolean`                                                | `true`                                                               |
| `25`                                                                                                   | NUMERIC      | not applicable | `number`                                             | `25`                                                                 |
| "a string text"                                                                                        | STRING       | TEXT           | `string`                                              | `a string text`                                                      |
| <pre>{<br>  "firefox": {<br>    "name": "Firefox",<br>    "pref_url": "about:config"<br>  }<br>}</pre> | STRING       | JSON           | `JSON object`                              | `{"firefox":{"name":"Firefox","pref_url":"about:config"}}` |
| <pre>men:<br>  - John Smith<br>  - Bill Jones<br>women:<br>  - Mary Smith<br>  - Susan Williams</pre>  | STRING       | YAML           | `string`                              | `"men:\n  - John Smith\n  - Bill Jones\nwomen:\n  - Mary Smith\n  - Susan Williams"` |
</details>

<details><summary>Feature flag usage Example</summary>

  ```javascript
  const feature = appConfigClient.getFeature('json-feature');
  feature.getFeatureDataType(); // STRING
  feature.getFeatureDataFormat(); // JSON

  // Example (traversing the returned JSON)
  let result = feature.getCurrentValue(entityId, entityAttributes);
  console.log(result.key) // prints the value of the key

  const feature = appConfigClient.getFeature('yaml-feature');
  feature.getFeatureDataType(); // STRING
  feature.getFeatureDataFormat(); // YAML
  feature.getCurrentValue(entityId, entityAttributes); // returns the stringified yaml (check above table)
  ```
</details>
<details><summary>Property usage example</summary>

  ```javascript
  const property = appConfigClient.getProperty('json-property');
  property.getPropertyDataType(); // STRING
  property.getPropertyDataFormat(); // JSON

  // Example (traversing the returned JSON)
  let result = property.getCurrentValue(entityId, entityAttributes);
  console.log(result.key) // prints the value of the key

  const property = appConfigClient.getProperty('yaml-property');
  property.getPropertyDataType(); // STRING
  property.getPropertyDataFormat(); // YAML
  property.getCurrentValue(entityId, entityAttributes); // returns the stringified yaml (check above table)
  ```
</details>

## Set listener for feature and property data changes

The SDK provides an event-based mechanism to notify you in real-time when feature flag's or property's configuration changes. You can listen to `configurationUpdate` event using the same appConfigClient.

```javascript
appConfigClient.emitter.on('configurationUpdate', () => {
  // **add your code**
  // To find the effect of any configuration changes, you can call the feature or property related methods

  // feature = appConfigClient.getFeature('online-check-in');
  // newValue = feature.getCurrentValue(entityId, entityAttributes);
});
```

## Examples

Try [this](https://github.com/IBM/appconfiguration-js-client-sdk/tree/main/example) sample application in the examples
folder to learn more about feature and property evaluation.

## License

This project is released under the Apache 2.0 license. The license's full text can be found
in [LICENSE](https://github.com/IBM/appconfiguration-js-client-sdk/blob/main/LICENSE)

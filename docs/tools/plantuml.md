# PlantUML

UML diagrams created in code and rendered as SVG with [PlantUML](https://plantuml.com/)

## Sequence Diagram Rendering

To create or update the renders for the Plant UML sequence diagrams

#### Ensure Java is installed

```shell
java -version
```

The output will vary depending on OS, however if it fails claiming Java is not found, then you must install before proceeding.

#### Generate renders for all Plant UML documents under `docs/spec`

```shell
npm run plant
```

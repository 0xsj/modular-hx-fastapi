# Composition root

Select concrete adapters, bind explicit runtime tokens, and construct application
objects here. Nest's module graph belongs at this assembly boundary. Root may know
the modules it connects; modules must not import root.

The existing `AppController`, `AppService`, and controller test are the generated
greeting smoke example. They remain together here as disposable process scaffolding.
`AppService` is not a model for future application use cases: those stay free of
Nest decorators inside their owning business module. Future business controllers
belong in the module's `transport/` directory.

`src/main.ts` starts this composition. Resource validation, worker startup, and
shutdown ownership should become explicit here as those resources are introduced.

```bash
(cd apps/web && yarn dev) & (cd apps/mobile && EAS_NO_VCS=1 EAS_PROJECT_ROOT=. EXPO_NO_METRO_LAZY=1 EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 yarn dlx expo start --offline --web)
```

# Managing e2b

All of this requires the e2b cli to be installed.

## How to develop on your own template
### Create your template
1. Make sure you have auth configured to the devleopment team
2. NOTE: you will have to stop this command soon after running it. This is the only way I know how to create a template...
3. Run:
```bash
e2b template build
```
and after about a second, just cancel it This will create an e2b.toml file in the current directory.The only important part of this config is the template_id.

1. Now, move this file to e2b.local.toml. This will ensure it is not committed
1. Finally, copy the other relevant fileds from the e2b.development.beta.toml file to your e2b.local.toml file.
1. Set your template_name to something that is specific to you e.g. "create-development-marcus"
1. Go into launchdarkly (https://app.launchdarkly.com/projects/flux/flags/e2b-monorepo-template/targeting?env=production&env=development&selected-env=development)
1. Add your template name as a variation, and configure it to be served in whatever environments you want in the development environment.

NOTE: if you want to test it in production, you will have to create your own template (with a different id) in the production team as well.

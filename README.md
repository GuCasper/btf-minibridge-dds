# BTF MiniBridge DDS

Private Double Dummy Solver service for the Bridge the Future MiniBridge table.

## Render settings

- Runtime: Docker
- Dockerfile path: `./Dockerfile`
- Health check path: `/health`
- Environment variable: `DDS_API_TOKEN` with a long random secret

After deployment, the health URL is:

```text
https://YOUR-SERVICE.onrender.com/health
```

The GoDaddy PHP configuration uses:

```text
https://YOUR-SERVICE.onrender.com/solve
```

The DDS wrapper and solver bundle are distributed under the Apache-2.0 license included in `LICENSE`.

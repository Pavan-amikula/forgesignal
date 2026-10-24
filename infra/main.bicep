@description('Publicly pullable container image, preferably pinned by digest')
param image string
@description('IPv4 CIDR permitted to reach the evaluation demo, e.g. your public IP/32')
param allowedCidr string
@secure()
@minLength(24)
param writeToken string
param location string = resourceGroup().location
param name string = 'forgesignal'

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {}
}
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [{ name: 'write-token', value: writeToken }]
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        ipSecurityRestrictions: [{ name: 'reviewer', action: 'Allow', ipAddressRange: allowedCidr }]
      }
    }
    template: {
      containers: [{
        name: name
        image: image
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'FORGE_WRITE_TOKEN', secretRef: 'write-token' }
          { name: 'OMP_NUM_THREADS', value: '1' }
        ]
        probes: [{
          type: 'Liveness'
          httpGet: { path: '/api/health', port: 8000 }
          initialDelaySeconds: 30
          periodSeconds: 30
        }]
      }]
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}
output url string = 'https://${app.properties.configuration.ingress.fqdn}'

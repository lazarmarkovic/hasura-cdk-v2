import * as cdk from 'aws-cdk-lib';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi, MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';
import * as route53_targets from 'aws-cdk-lib/aws-route53-targets';
import { PublicHostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import * as path from 'path';
import { RetainedLambdaLayerVersion } from './retained-lambda-layer';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';

export interface ActionsProps extends cdk.StackProps {
  appName: string;
  actionsHostname: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class Actions {

  constructor(mainStack: cdk.Stack, id: string, props: ActionsProps) {

    const hostedZone = PublicHostedZone.fromPublicHostedZoneAttributes(mainStack, 'ActionsHostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName
    });

    const actionsCert = new DnsValidatedCertificate(mainStack, 'ActionsCertificate', {
      hostedZone,
      domainName: props.actionsHostname,
    });

    const api = new RestApi(mainStack, 'ActionsApi', {
      domainName: {
        domainName: props.actionsHostname,
        certificate: actionsCert,
      },
      restApiName: 'Actions',
      description: 'Endpoint For Hasura Actions',
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // API DNS record
    new ARecord(mainStack, 'ActionsApiAliasRecord', {
      zone: hostedZone,
      recordName: props.actionsHostname,
      target: RecordTarget.fromAlias(new route53_targets.ApiGateway(api)),
    });

    // Create a lambda layer to contain node_modules
    const handlerDependenciesLayer = new RetainedLambdaLayerVersion(mainStack, 'ActionHandlerDependencies', {
      contentLocation: 'actions/dependencies-layer',
      description: 'Dependencies layer',
      compatibleRuntimes: [Runtime.NODEJS_16_X],
    });

    const actionHandler = new Function(mainStack, 'ActionHandler', {
      functionName: `${props.appName}-ActionHandler`,
      handler: 'handler.handler',
      memorySize: 1024,
      runtime: Runtime.NODEJS_16_X,
      code: Code.fromAsset(path.join(__dirname, '../../actions/dist/')),
      timeout: cdk.Duration.seconds(4),
      layers: [handlerDependenciesLayer],
    });

    const handlerResource = api.root.addResource('handler');
    const actionHandlerIntegration = new LambdaIntegration(actionHandler);

    handlerResource.addMethod('POST', actionHandlerIntegration);
    handlerResource.addMethod('GET', actionHandlerIntegration);
  }
}

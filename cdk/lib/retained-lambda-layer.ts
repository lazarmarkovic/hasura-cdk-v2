import * as cdk from 'aws-cdk-lib';
import { LayerVersion, LayerVersionProps, CfnLayerVersion, Runtime, Code } from 'aws-cdk-lib/aws-lambda';

export interface LambdaLayerProps {
    readonly contentLocation: string;
    readonly compatibleRuntimes?: Runtime[];
    readonly description?: string;
    readonly license?: string;
}

export class RetainedLambdaLayerVersion extends LayerVersion {

    constructor(scope: cdk.Stack, id: string, props: LambdaLayerProps) {

        const lambdaVersionProps: LayerVersionProps = {
            description: props.description,
            compatibleRuntimes: props.compatibleRuntimes,
            code: Code.fromAsset(props.contentLocation),
            license: props.license,
        };

        super(scope, id, lambdaVersionProps);

        const layerVersion = this.node.findChild('Resource') as CfnLayerVersion;
        layerVersion.addOverride('UpdateReplacePolicy', 'Retain'); // retain old layer versions (see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-updatereplacepolicy.html & https://www.reddit.com/r/aws/comments/amecr5/cloudformation_awslambdalayerversion_how_to/)

    }
}

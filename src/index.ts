// The bundle entry: pulls the styles in for the CSS build artifact, while
// `LovelyChart.ts` stays importless of assets so its emitted declarations
// resolve in consumer projects
import './styles/index.scss';

export * from './LovelyChart';

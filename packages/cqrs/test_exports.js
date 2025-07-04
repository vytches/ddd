const cqrs = require('./packages/cqrs/dist/index.cjs');

console.log('Available exports:');
console.log(Object.keys(cqrs).sort());
console.log('');
console.log('Core interfaces available:', \!\!cqrs.ICommandBus && \!\!cqrs.IQueryBus);
console.log('Implementations available:', \!\!cqrs.CommandBus && \!\!cqrs.QueryBus);
console.log('Enhanced implementations available:', \!\!cqrs.EnhancedCommandBus && \!\!cqrs.EnhancedQueryBus);
console.log('Decorators available:', \!\!cqrs.CommandHandler && \!\!cqrs.QueryHandler);
console.log('Configuration available:', \!\!cqrs.CQRSModule && \!\!cqrs.CQRSConfiguration);

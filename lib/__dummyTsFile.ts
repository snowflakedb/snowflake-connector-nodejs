import { testJsFn } from './__dummyJsFile';

const testFn = () => {
  testJsFn();
  console.log('im ts file');
};

export default testFn;

const executionService = require('./execution.service');
const paizaClient = require('./paiza.client');

jest.mock('./paiza.client');

describe('Execution Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute supported language successfully', async () => {
    paizaClient.createRunner.mockResolvedValue({ id: 'test-runner-id', status: 'running' });
    paizaClient.getRunnerDetails.mockResolvedValue({
      id: 'test-runner-id',
      status: 'completed',
      result: 'success',
      stdout: 'Hello World\n',
      stderr: '',
      build_result: 'success',
      time: '0.01',
      memory: 1024,
    });

    const result = await executionService.runCode({ language: 'python3', sourceCode: 'print("Hello World")', stdin: '' });

    expect(result.status).toBe('completed');
    expect(result.stdout).toBe('Hello World\n');
    expect(paizaClient.createRunner).toHaveBeenCalledWith('python3', 'print("Hello World")', '');
    expect(paizaClient.getRunnerDetails).toHaveBeenCalledWith('test-runner-id');
  });

  it('should throw error for unsupported language', async () => {
    await expect(executionService.runCode({ language: 'unsupported', sourceCode: 'xxx', stdin: '' }))
      .rejects.toThrow('Unsupported language: unsupported');
  });

  it('should handle execution timeout', async () => {
    paizaClient.createRunner.mockResolvedValue({ id: 'test-runner-id', status: 'running' });
    paizaClient.getRunnerDetails.mockResolvedValue({ status: 'running' });

    // This test will take ~15 seconds due to delay loop
    // so we mock setTimeout temporarily for this specific test
    jest.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());
    
    await expect(executionService.runCode({ language: 'python3', sourceCode: 'while True: pass', stdin: '' }))
      .rejects.toThrow('Execution timed out');
      
    global.setTimeout.mockRestore();
  });
});

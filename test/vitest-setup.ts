// 抑制 E2E 测试清理时的未处理 promise rejection
// 当进程被 SIGTERM 终止时的预期行为
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.message.includes('SIGTERM')) {
    return;
  }
  if (reason && typeof reason === 'object' && 'shortMessage' in reason) {
    const msg = (reason as { shortMessage: string }).shortMessage;
    if (msg.includes('SIGTERM') || msg.includes('Termination')) {
      return;
    }
  }
});

# api/slurm/ssh.py
"""
The ONLY place that talks to the cluster.
Every command is an argument LIST, joined with shlex.join, so no
value can ever be interpreted by the remote shell.
"""
import os
import shlex
import paramiko

MOCK_MODE = os.getenv('MOCK_MODE', 'False') == 'True'   # off unless explicitly enabled
USE_SUDO = os.getenv('HPC_USE_SUDO', 'False') == 'True'
CONNECT_TIMEOUT = 10
COMMAND_TIMEOUT = 90   # the create script sleeps ~11s for NIS restarts


class HPCSession:
    """
    One SSH connection that can run several commands:

        with HPCSession() as hpc:
            hpc.run(['sacctmgr', 'show', 'qos', '--parsable2'])
    """

    def __enter__(self):
        self.client = None
        if MOCK_MODE:
            return self

        client = paramiko.SSHClient()
        # Trust only known host keys. Add the cluster once with:
        #   ssh-keyscan <host> >> ~/.ssh/known_hosts
        client.load_system_host_keys()
        known_hosts = os.getenv('HPC_KNOWN_HOSTS')
        if known_hosts:
            client.load_host_keys(known_hosts)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())

        client.connect(
            hostname=os.environ['HPC_HOST'],
            port=int(os.getenv('HPC_PORT', 22)),
            username=os.environ['HPC_USERNAME'],
            key_filename=os.getenv('HPC_KEY_PATH') or None,   # prefer key auth
            password=os.getenv('HPC_PASSWORD') or None,       # fallback only
            timeout=CONNECT_TIMEOUT,
            auth_timeout=CONNECT_TIMEOUT,
            banner_timeout=CONNECT_TIMEOUT,
        )
        self.client = client
        return self

    def run(self, args: list[str], input_data: str | None = None) -> dict:
        """
        Run a command given as an argument LIST (never a raw string).
        input_data is written to the command's stdin, used for secrets
        (passwords) so they never appear in the remote process list.
        """
        if MOCK_MODE:
            from .mock import mock_run
            return mock_run(args)

        if USE_SUDO:
            args = ['sudo', '-n', *args]   # -n: fail instead of waiting for a password
        command = shlex.join(args)

        try:
            stdin, stdout, stderr = self.client.exec_command(command, timeout=COMMAND_TIMEOUT)
            if input_data is not None:
                stdin.write(input_data)
                stdin.channel.shutdown_write()
            output = stdout.read().decode('utf-8', errors='replace').strip()
            error = stderr.read().decode('utf-8', errors='replace').strip()
            exit_status = stdout.channel.recv_exit_status()
            return {'success': exit_status == 0, 'output': output, 'error': error}
        except Exception as e:
            return {'success': False, 'output': '', 'error': str(e)}

    def __exit__(self, exc_type, exc, tb):
        if self.client:
            self.client.close()
        return False


def run_remote_command(args: list[str], input_data: str | None = None) -> dict:
    """Convenience wrapper for a single command."""
    try:
        with HPCSession() as hpc:
            return hpc.run(args, input_data)
    except Exception as e:   # connection / auth / host-key failures
        return {'success': False, 'output': '', 'error': f'SSH error: {e}'}

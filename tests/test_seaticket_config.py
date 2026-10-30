import importlib.util
import logging
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_module(name, relative_path):
    spec = importlib.util.spec_from_file_location(name, PROJECT_ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SeaticketConfigTests(unittest.TestCase):
    def test_web_section_overrides_global_without_reading_old_section(self):
        config_parser = load_module('seaticket_config_parser', 'seahub/config_parser.py')
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / 'seaticket_config.yaml'
            config_path.write_text(
                'global:\n  TEST_VALUE: global\n'
                'seaqa-web:\n  TEST_VALUE: old\n  OLD_ONLY: true\n'
                'seaticket:\n  TEST_VALUE: seaticket\n',
                encoding='utf-8',
            )
            with patch.dict('os.environ', {}, clear=True):
                configs = config_parser.ConfigParser(str(config_path), 'seaticket')
                self.assertEqual(configs.get('TEST_VALUE'), 'seaticket')
                self.assertIsNone(configs.get('OLD_ONLY'))
                with patch.dict('os.environ', {'TEST_VALUE': 'environment'}):
                    self.assertEqual(configs.get('TEST_VALUE'), 'environment')

    def test_io_stdout_uses_seaticket_component(self):
        log = load_module('seaticket_io_log', 'seaqa_io/log.py')
        logger = logging.Logger('seaqa_io')
        with patch.dict('os.environ', {'SEATICKET_LOG_TO_STDOUT': 'true'}, clear=True):
            with patch.object(log.logging, 'getLogger', return_value=logger):
                log.setup_logger('seaqa_io', propagate=False)
        self.assertEqual(len(logger.handlers), 1)
        record = logging.LogRecord('seaqa_io', logging.INFO, __file__, 1, 'test', (), None)
        self.assertTrue(logger.handlers[0].format(record).startswith('[seaticket-io]'))
        logger.handlers[0].close()

    def test_io_file_uses_seaticket_filename_and_ignores_old_stdout_variable(self):
        log = load_module('seaticket_io_log', 'seaqa_io/log.py')
        logger = logging.Logger('seaqa_io')
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict('os.environ', {
                'LOG_DIR': directory,
                'SEAQA_LOG_TO_STDOUT': 'true',
            }, clear=True):
                with patch.object(log.logging, 'getLogger', return_value=logger):
                    log.setup_logger('seaqa_io', propagate=False)
            try:
                self.assertEqual(len(logger.handlers), 1)
                self.assertEqual(
                    logger.handlers[0].baseFilename,
                    str(Path(directory) / 'seaticket-io.log'),
                )
            finally:
                for handler in logger.handlers:
                    handler.close()

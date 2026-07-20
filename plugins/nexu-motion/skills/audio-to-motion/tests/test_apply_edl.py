import importlib.util
import pathlib
import unittest


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "apply_edl.py"
SPEC = importlib.util.spec_from_file_location("apply_edl", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ApplyEdlTests(unittest.TestCase):
    def test_keep_intervals_are_complement_of_removals(self):
        removals = [{"start": 1.0, "end": 2.0}, {"start": 4.5, "end": 5.0}]
        self.assertEqual(
            MODULE.keep_intervals(removals, 6.0),
            [{"start": 0.0, "end": 1.0}, {"start": 2.0, "end": 4.5}, {"start": 5.0, "end": 6.0}],
        )

    def test_time_mapping_subtracts_prior_cuts(self):
        removals = [{"start": 1.0, "end": 2.0}, {"start": 4.0, "end": 4.5}]
        self.assertAlmostEqual(MODULE.map_time(3.0, removals), 2.0)
        self.assertAlmostEqual(MODULE.map_time(5.0, removals), 3.5)

    def test_removed_words_drop_and_remaining_words_shift(self):
        words = [
            {"start": 0.2, "end": 0.5, "text": "keep"},
            {"start": 1.2, "end": 1.5, "text": "remove"},
            {"start": 2.2, "end": 2.5, "text": "shift"},
        ]
        result = MODULE.remap_words(words, [{"start": 1.0, "end": 2.0}])
        self.assertEqual([word["text"] for word in result], ["keep", "shift"])
        self.assertAlmostEqual(result[1]["start"], 1.2)

    def test_time_scoped_transcript_correction_replaces_words(self):
        words = [
            {"start": 2.0, "end": 2.4, "text": "$299"},
            {"start": 2.4, "end": 2.7, "text": "today"},
        ]
        result = MODULE.apply_transcript_corrections(
            words,
            [{"start": 2.0, "end": 2.4, "text": "₹299"}],
        )
        self.assertEqual([word["text"] for word in result], ["₹299", "today"])


if __name__ == "__main__":
    unittest.main()

import java.util.Random;

public class BogoBogoSort {
    static Random rand = new Random();

    public static void bogoBogoSort(int[] arr) {
        int[] copy = new int[arr.length];
        while (!isSorted(arr)) {
            shuffle(arr);
            System.out.println("Trying: " + java.util.Arrays.toString(arr));
        }
    }

    private static boolean isSorted(int[] arr) {
        return isSortedPrefix(arr, arr.length);
    }

    private static boolean isSortedPrefix(int[] arr, int n) {
        if (n <= 1) return true;
        int[] prefix = java.util.Arrays.copyOf(arr, n - 1);
        bogoBogoSort(prefix);
        for (int i = 0; i < n - 2; i++) {
            if (prefix[i] > prefix[i + 1]) return false;
        }
        return arr[n - 2] <= arr[n - 1];
    }

    private static void shuffle(int[] arr) {
        for (int i = 0; i < arr.length; i++) {
            int j = rand.nextInt(arr.length);
            int temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }

    public static void main(String[] args) {
        int[] data = {3, 2, 1}; // WARNING: More than 3 elements is pain
        bogoBogoSort(data);
        System.out.print("Sorted: ");
        for (int num : data) {
            System.out.print(num + " ");
        }
    }
}